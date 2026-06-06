const storedData = new Map<number, string>();
let nextId = 0;

export function resetMockCrypto() {
  storedData.clear();
  nextId = 0;
}

export const mockCrypto = {
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algo: any, str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  },
  AESEncryptionKey: {
    import: (bytes: Uint8Array) => {
      const id = ++nextId;
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      return { _id: id, _hex: hex, encoded: async (fmt: string) => fmt === 'hex' ? hex : '' };
    },
    generate: async () => {
      const id = ++nextId;
      const hex = 'generated-key-' + id;
      return { _id: id, _hex: hex, encoded: async (fmt: string) => fmt === 'hex' ? hex : '' };
    },
  },
  aesEncryptAsync: async (plaintext: string, _key: any) => {
    const id = ++nextId;
    storedData.set(id, plaintext);
    return {
      combined: async () => {
        const bytes = new Uint8Array(4);
        bytes[0] = (id >> 24) & 0xFF;
        bytes[1] = (id >> 16) & 0xFF;
        bytes[2] = (id >> 8) & 0xFF;
        bytes[3] = id & 0xFF;
        return bytes;
      },
    };
  },
  AESSealedData: {
    fromCombined: (data: Uint8Array) => {
      const id = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
      return { _id: id };
    },
  },
  aesDecryptAsync: async (sealed: any, _key: any, _opts: any) => {
    return storedData.get(sealed._id) || '';
  },
};
