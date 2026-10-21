/**
 * AES-256-GCM encryptor for stored secrets (MFA seeds, webhook signing keys).
 *
 * Ciphertext is self-contained (IV + auth tag + payload) and base64url-encoded.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ConfigurationError } from '../../shared/errors/index.js';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
/** Implements {@link ../../shared/security/secret-encryptor.port.js} for at-rest secret fields. */
export class AesSecretEncryptor {
    key;
    /** @param {string} encryptionKey UTF-8 string that must decode to 32 bytes for AES-256. */
    constructor(encryptionKey) {
        if (encryptionKey.length !== 32) {
            throw new ConfigurationError('MFA encryption key must be exactly 32 bytes');
        }
        this.key = Buffer.from(encryptionKey, 'utf8');
    }
    /** Returns base64url ciphertext: IV || auth tag || encrypted bytes. */
    encrypt(plaintext) {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
    }
    /** Decrypts {@link encrypt} output; verifies GCM auth tag before returning UTF-8 plaintext. */
    decrypt(ciphertext) {
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
