import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption for platform secrets at rest.
 * Key: PLATFORM_SECRETS_ENCRYPTION_KEY (64-char hex = 32 bytes).
 */
@Injectable()
export class SecretCipherService {
  private readonly logger = new Logger(SecretCipherService.name);

  isConfigured(): boolean {
    return Boolean(this.key());
  }

  encrypt(plaintext: string): string {
    const key = this.key();
    if (!key) {
      throw new Error('PLATFORM_SECRETS_ENCRYPTION_KEY is required to store platform secrets');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const key = this.key();
    if (!key) {
      throw new Error('PLATFORM_SECRETS_ENCRYPTION_KEY is required to read platform secrets');
    }

    const buffer = Buffer.from(ciphertext, 'base64');
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new Error('Invalid encrypted payload');
    }

    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private key(): Buffer | null {
    const raw = process.env.PLATFORM_SECRETS_ENCRYPTION_KEY?.trim();
    if (!raw) return null;
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      this.logger.warn('PLATFORM_SECRETS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      return null;
    }
    return Buffer.from(raw, 'hex');
  }
}
