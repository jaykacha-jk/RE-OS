import { SecretCipherService } from './secret-cipher.service';

describe('SecretCipherService', () => {
  const originalEnv = process.env;
  const key = 'a'.repeat(64);

  beforeEach(() => {
    process.env = { ...originalEnv, PLATFORM_SECRETS_ENCRYPTION_KEY: key };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('round-trips plaintext', () => {
    const cipher = new SecretCipherService();
    const encrypted = cipher.encrypt('{"key_id":"rzp_test"}');
    expect(cipher.decrypt(encrypted)).toBe('{"key_id":"rzp_test"}');
  });

  it('rejects tampered ciphertext', () => {
    const cipher = new SecretCipherService();
    const encrypted = Buffer.from(cipher.encrypt('secret'), 'base64');
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => cipher.decrypt(encrypted.toString('base64'))).toThrow();
  });
});
