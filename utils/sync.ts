import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SyncPackage, SettingRow, EntitySyncInfo } from '../db/types';
import { getDatabase } from '../db';

const MAGIC = new Uint8Array([0x4D, 0x32, 0x4D]); // "M2M"
const VERSION = 1;
const BIOMETRIC_KEY_STORE = 'm2m-sync-key';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export async function deriveKeyFromPassword(password: string): Promise<Crypto.AESEncryptionKey> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
  );
  const keyBytes = new Uint8Array(hash.length / 2);
  for (let i = 0; i < hash.length; i += 2) {
    keyBytes[i / 2] = parseInt(hash.substring(i, i + 2), 16);
  }
  return Crypto.AESEncryptionKey.import(keyBytes);
}

export async function getBiometricKey(): Promise<Crypto.AESEncryptionKey | null> {
  const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY_STORE);
  if (!stored) return null;
  return Crypto.AESEncryptionKey.import(stored, 'hex');
}

export async function createBiometricKey(): Promise<Crypto.AESEncryptionKey> {
  const key = await Crypto.AESEncryptionKey.generate();
  const hex = await key.encoded('hex');
  await SecureStore.setItemAsync(BIOMETRIC_KEY_STORE, hex, {
    requireAuthentication: true,
  });
  return key;
}

export async function buildSyncPackage(): Promise<SyncPackage> {
  const db = await getDatabase();
  const bills = await db.getAllAsync('SELECT * FROM bills ORDER BY id');
  const payments = await db.getAllAsync('SELECT * FROM payments ORDER BY id');
  const settingsRows = await db.getAllAsync(
    'SELECT key, value FROM settings ORDER BY key',
  ) as SettingRow[];
  const holidays = await db.getAllAsync(
    'SELECT * FROM holidays ORDER BY id',
  );
  const deletions = await db.getAllAsync(
    'SELECT * FROM sync_deletions ORDER BY id',
  ) as any[];

  const deletedBillIds = deletions
    .filter((d: any) => d.tableName === 'bills')
    .map((d: any) => d.rowId);
  const deletedPaymentIds = deletions
    .filter((d: any) => d.tableName === 'payments')
    .map((d: any) => d.rowId);

  return {
    exportedAt: Date.now(),
    lastSyncTimestamp: null,
    bills,
    payments,
    settings: settingsRows,
    deletedBillIds,
    deletedPaymentIds,
    holidays,
  };
}

export async function exportData(
  password?: string,
): Promise<Uint8Array> {
  const pkg = await buildSyncPackage();
  const json = JSON.stringify(pkg);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(json);
  const plaintextB64 = uint8ArrayToBase64(plaintext);

  let key: Crypto.AESEncryptionKey;
  let keySource = 0;
  if (password) {
    key = await deriveKeyFromPassword(password);
    keySource = 0;
  } else {
    key = await createBiometricKey();
    keySource = 1;
  }

  const sealedData = await Crypto.aesEncryptAsync(plaintextB64, key);
  const combined = await sealedData.combined();

  const header = new Uint8Array([MAGIC[0], MAGIC[1], MAGIC[2], VERSION, keySource]);
  return concat(header, combined);
}

export async function importData(
  data: Uint8Array,
  password?: string,
): Promise<{ imported: number }> {
  if (data.length < 5) {
    throw new Error('Invalid file: too short');
  }
  if (data[0] !== MAGIC[0] || data[1] !== MAGIC[1] || data[2] !== MAGIC[2]) {
    throw new Error('Invalid file: bad magic bytes');
  }
  const version = data[3];
  if (version !== 1) {
    throw new Error(`Invalid file: unsupported version ${version}`);
  }
  const keySource = data[4];

  let key: Crypto.AESEncryptionKey;
  if (keySource === 0) {
    if (!password) {
      throw new Error('Password required to decrypt this file');
    }
    key = await deriveKeyFromPassword(password);
  } else {
    const stored = await getBiometricKey();
    if (!stored) {
      throw new Error('No biometric key found. Export with a password or set up biometric encryption first.');
    }
    key = stored;
  }

  const combined = data.slice(5);
  const sealedData = Crypto.AESSealedData.fromCombined(combined);
  const plaintextB64 = await Crypto.aesDecryptAsync(sealedData, key, {
    output: 'base64',
  });

  const decoder = new TextDecoder();
  const plaintext = base64ToUint8Array(plaintextB64 as string);
  const json = decoder.decode(plaintext);
  const pkg: SyncPackage = JSON.parse(json);

  let imported = 0;
  const db = await getDatabase();

  for (const bill of pkg.bills) {
    const existing = await db.getFirstAsync(
      'SELECT id, updatedAt FROM bills WHERE id = ? LIMIT 1',
      [bill.id],
    ) as EntitySyncInfo | null;

    const incomingTime = bill.updatedAt ? new Date(bill.updatedAt).getTime() : 0;
    const existingTime = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      const cols = Object.keys(bill);
      const placeholders = cols.map(() => '?').join(', ');
      await db.runAsync(
        `INSERT INTO bills (${cols.join(', ')}) VALUES (${placeholders})`,
        cols.map(c => (bill as any)[c]),
      );
      imported++;
    } else if (incomingTime > existingTime) {
      const { id: _, ...values } = bill;
      const cols = Object.keys(values);
      const setClauses = cols.map(c => `${c} = ?`).join(', ');
      await db.runAsync(
        `UPDATE bills SET ${setClauses} WHERE id = ?`,
        [...cols.map(c => (values as any)[c]), bill.id],
      );
      imported++;
    }
  }

  for (const payment of pkg.payments) {
    const existing = await db.getFirstAsync(
      'SELECT id, updatedAt FROM payments WHERE id = ? LIMIT 1',
      [payment.id],
    ) as EntitySyncInfo | null;

    const incomingTime = payment.updatedAt ? new Date(payment.updatedAt).getTime() : 0;
    const existingTime = existing?.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;

    if (!existing) {
      const cols = Object.keys(payment);
      const placeholders = cols.map(() => '?').join(', ');
      await db.runAsync(
        `INSERT INTO payments (${cols.join(', ')}) VALUES (${placeholders})`,
        cols.map(c => (payment as any)[c]),
      );
      imported++;
    } else if (incomingTime > existingTime) {
      const { id: _, ...values } = payment;
      const cols = Object.keys(values);
      const setClauses = cols.map(c => `${c} = ?`).join(', ');
      await db.runAsync(
        `UPDATE payments SET ${setClauses} WHERE id = ?`,
        [...cols.map(c => (values as any)[c]), payment.id],
      );
      imported++;
    }
  }

  for (const setting of pkg.settings) {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      [setting.key, setting.value, setting.value],
    );
  }

  for (const billId of pkg.deletedBillIds) {
    await db.runAsync('DELETE FROM bills WHERE id = ?', [billId]);
    await db.runAsync(
      'DELETE FROM sync_deletions WHERE tableName = ? AND rowId = ?',
      ['bills', billId],
    );
  }

  for (const paymentId of pkg.deletedPaymentIds) {
    await db.runAsync('DELETE FROM payments WHERE id = ?', [paymentId]);
    await db.runAsync(
      'DELETE FROM sync_deletions WHERE tableName = ? AND rowId = ?',
      ['payments', paymentId],
    );
  }

  if (pkg.holidays) {
    for (const holiday of pkg.holidays) {
      const existing = await db.getFirstAsync(
        'SELECT id FROM holidays WHERE id = ? LIMIT 1',
        [holiday.id],
      );
      if (existing) {
        await db.runAsync(
          'UPDATE holidays SET date = ?, name = ?, recurring = ?, affectsPay = ? WHERE id = ?',
          [holiday.date, holiday.name, holiday.recurring ? 1 : 0, holiday.affectsPay ? 1 : 0, holiday.id],
        );
      } else {
        await db.runAsync(
          'INSERT INTO holidays (id, date, name, recurring, affectsPay) VALUES (?, ?, ?, ?, ?)',
          [holiday.id, holiday.date, holiday.name, holiday.recurring ? 1 : 0, holiday.affectsPay ? 1 : 0],
        );
      }
    }
  }

  return { imported };
}
