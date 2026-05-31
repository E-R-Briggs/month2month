import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as schema from '../db/schema';
import type { SyncPackage, Bill, Payment } from '../db/types';
import { getDatabase, eq, desc, and, or, isNull, sql, getCurrentMonth } from '../db';

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

export async function deleteBiometricKey() {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORE);
}

export async function buildSyncPackage(): Promise<SyncPackage> {
  const db = getDatabase();
  const bills = await db
    .select()
    .from(schema.bills)
    .orderBy(schema.bills.id);
  const payments = await db
    .select()
    .from(schema.payments)
    .orderBy(schema.payments.id);
  const settingsRows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings);

  const deletions = await db
    .select()
    .from(schema.syncDeletions)
    .orderBy(schema.syncDeletions.id);

  const deletedBillIds = deletions
    .filter(d => d.tableName === 'bills')
    .map(d => d.rowId);
  const deletedPaymentIds = deletions
    .filter(d => d.tableName === 'payments')
    .map(d => d.rowId);

  return {
    exportedAt: Date.now(),
    lastSyncTimestamp: null,
    bills,
    payments,
    settings: settingsRows,
    deletedBillIds,
    deletedPaymentIds,
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
  const db = getDatabase();

  for (const bill of pkg.bills) {
    const existing = await db
      .select({ id: schema.bills.id, updatedAt: schema.bills.updatedAt })
      .from(schema.bills)
      .where(eq(schema.bills.id, bill.id))
      .limit(1);

    const incomingTime = bill.updatedAt ? new Date(bill.updatedAt).getTime() : 0;
    const existingTime = existing[0]?.updatedAt
      ? new Date(existing[0].updatedAt).getTime()
      : 0;

    if (!existing[0]) {
      const { id, ...values } = bill;
      await db.insert(schema.bills).values({ id, ...values } as any);
      imported++;
    } else if (incomingTime > existingTime) {
      const { id, ...values } = bill;
      await db.update(schema.bills).set(values as any).where(eq(schema.bills.id, bill.id));
      imported++;
    }
  }

  for (const payment of pkg.payments) {
    const existing = await db
      .select({ id: schema.payments.id, updatedAt: schema.payments.updatedAt })
      .from(schema.payments)
      .where(eq(schema.payments.id, payment.id))
      .limit(1);

    const incomingTime = payment.updatedAt ? new Date(payment.updatedAt).getTime() : 0;
    const existingTime = existing[0]?.updatedAt
      ? new Date(existing[0].updatedAt).getTime()
      : 0;

    if (!existing[0]) {
      const { id, ...values } = payment;
      await db.insert(schema.payments).values({ id, ...values } as any);
      imported++;
    } else if (incomingTime > existingTime) {
      const { id, ...values } = payment;
      await db.update(schema.payments).set(values as any).where(eq(schema.payments.id, payment.id));
      imported++;
    }
  }

  for (const setting of pkg.settings) {
    await db
      .insert(schema.settings)
      .values(setting)
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: setting.value } });
  }

  for (const billId of pkg.deletedBillIds) {
    await db.delete(schema.bills).where(eq(schema.bills.id, billId));
    await db.delete(schema.syncDeletions).where(
      and(
        eq(schema.syncDeletions.tableName, 'bills'),
        eq(schema.syncDeletions.rowId, billId),
      ),
    );
  }

  for (const paymentId of pkg.deletedPaymentIds) {
    await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));
    await db.delete(schema.syncDeletions).where(
      and(
        eq(schema.syncDeletions.tableName, 'payments'),
        eq(schema.syncDeletions.rowId, paymentId),
      ),
    );
  }

  return { imported };
}
