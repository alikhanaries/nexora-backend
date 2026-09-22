/**
 * Provider-neutral encryption port for reversible secret storage.
 *
 * Concrete implementations live in infrastructure (for example
 * {@link AesSecretEncryptor}). Application code depends on this shape only.
 */

/**
 * @typedef {object} SecretEncryptorPort
 * @property {(plaintext: string) => string} encrypt
 * @property {(ciphertext: string) => string} decrypt
 */

export {};
