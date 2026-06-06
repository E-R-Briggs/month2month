import { mockCrypto, resetMockCrypto } from './helpers/mock-expo-crypto';

jest.mock('expo-crypto', () => mockCrypto);

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  authenticateAsync: async () => ({ success: true }),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { store.set(key, value); },
    deleteItemAsync: async (key: string) => { store.delete(key); },
  };
});

import { hashPin } from '../hooks/useAppLock';

beforeEach(() => {
  resetMockCrypto();
});

describe('hashPin', () => {
  it('produces a hex string', async () => {
    const hash = await hashPin('1234');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same PIN', async () => {
    const hash1 = await hashPin('0000');
    const hash2 = await hashPin('0000');
    expect(hash1).toBe(hash2);
  });

  it('differs for different PINs', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('5678');
    expect(hash1).not.toBe(hash2);
  });
});
