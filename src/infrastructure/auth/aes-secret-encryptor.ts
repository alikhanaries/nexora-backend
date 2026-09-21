import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { SecretEncryptor } from '../../shared/auth/index.js';
import { ConfigurationError } from '../../shared/errors/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class AesSecretEncryptor implements SecretEncryptor {
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    if (encryptionKey.length !== 32) {
      throw new ConfigurationError('MFA encryption key must be exactly 32 bytes');
    }
    this.key = Buffer.from(encryptionKey, 'utf8');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64url');
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new ConfigurationError('Ciphertext is too short');
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
