import { setupTestDb, teardownTestDb } from './helpers/setup';
import { resetMockCrypto, mockCrypto } from './helpers/mock-expo-crypto';

jest.mock('expo-crypto', () => mockCrypto);

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string, _opts?: any) => { store.set(key, value); },
    deleteItemAsync: async (key: string) => { store.delete(key); },
  };
});

import {
  buildSyncPackage,
  exportData,
  importData,
  deriveKeyFromPassword,
} from '../utils/sync';
import { addBill, setPay, setSetting, getLabels } from '../db';

beforeEach(() => {
  setupTestDb();
  resetMockCrypto();
});

afterEach(() => {
  teardownTestDb();
});

describe('buildSyncPackage', () => {
  it('returns an empty sync package when nothing is stored', async () => {
    const pkg = await buildSyncPackage();
    expect(pkg.bills).toEqual([]);
    expect(pkg.payments).toEqual([]);
    expect(pkg.settings).toEqual([]);
    expect(pkg.deletedBillIds).toEqual([]);
    expect(pkg.deletedPaymentIds).toEqual([]);
  });

  it('includes stored bills and payments', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 1, 'bills');
    await setPay(2000, '2026-04', 15);
    const pkg = await buildSyncPackage();
    expect(pkg.bills).toHaveLength(1);
    expect(pkg.bills[0].name).toBe('Rent');
    expect(pkg.payments).toHaveLength(1);
    expect(pkg.payments[0].amount).toBe(2000);
  });

  it('includes settings', async () => {
    await setSetting('theme', 'dark');
    const pkg = await buildSyncPackage();
    expect(pkg.settings).toHaveLength(1);
    expect(pkg.settings[0]).toEqual({ key: 'theme', value: 'dark' });
  });
});

describe('exportData / importData', () => {
  it('validates magic bytes', async () => {
    await expect(importData(new Uint8Array([0, 0, 0, 1, 0]))).rejects.toThrow('bad magic bytes');
  });

  it('validates minimum length', async () => {
    await expect(importData(new Uint8Array([0x4D, 0x32, 0x4D]))).rejects.toThrow('too short');
  });

  it('validates version byte', async () => {
    const data = new Uint8Array([0x4D, 0x32, 0x4D, 99, 0]);
    await expect(importData(data)).rejects.toThrow('unsupported version 99');
  });

  it('rejects password-encrypted file without password', async () => {
    const data = new Uint8Array([0x4D, 0x32, 0x4D, 1, 0]);
    await expect(importData(data)).rejects.toThrow('Password required');
  });

  it('exports and imports with password round-trip', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 1, 'bills');
    await setPay(2000, '2026-04', 15);
    await setSetting('currency', 'USD');

    const exported = await exportData('test-password');
    expect(exported[0]).toBe(0x4D);
    expect(exported[1]).toBe(0x32);
    expect(exported[2]).toBe(0x4D);
    expect(exported[3]).toBe(1);
    expect(exported[4]).toBe(0);

    teardownTestDb();
    setupTestDb();

    const result = await importData(exported, 'test-password');
    expect(result.imported).toBeGreaterThan(0);
  });

  it('buildSyncPackage returns correct bill count for import', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 1, 'bills');
    const pkg = await buildSyncPackage();
    expect(pkg.bills).toHaveLength(1);
  });
});

describe('deriveKeyFromPassword', () => {
  it('produces a deterministic result for the same password', async () => {
    const key1 = await deriveKeyFromPassword('hello') as any;
    const key2 = await deriveKeyFromPassword('hello') as any;
    expect(key1._hex).toBe(key2._hex);
  });

  it('produces different results for different passwords', async () => {
    const key1 = await deriveKeyFromPassword('hello') as any;
    const key2 = await deriveKeyFromPassword('world') as any;
    expect(key1._hex).not.toBe(key2._hex);
  });
});
