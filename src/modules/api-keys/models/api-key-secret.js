import { randomBytes } from 'node:crypto';
import { hashSecret } from '../../../shared/security/index.js';
const PREFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Generates a random `nxk_<8 chars>` public prefix used to look up keys without scanning secrets. */
export function generateApiKeyPrefix() {
    let suffix = '';
    for (let index = 0; index < 8; index += 1) {
        suffix += PREFIX_CHARS[randomBytes(1)[0] % PREFIX_CHARS.length];
    }
    return `nxk_${suffix}`;
}

/** Generates a high-entropy secret segment (base64url, 32 bytes). Shown once at create/rotate. */
export function generateApiKeySecret() {
    return randomBytes(32).toString('base64url');
}

/**
 * Combines prefix and secret into the wire format clients send (`prefix.secret`).
 * @param {string} prefix
 * @param {string} secret
 * @returns {string}
 */
export function formatApiKey(prefix, secret) {
    return `${prefix}.${secret}`;
}

/**
 * Splits a raw API key into prefix and secret; rejects malformed strings (no dot, empty segments).
 * @param {string} rawKey
 * @returns {{ prefix: string, secret: string } | null}
 */
export function parseApiKey(rawKey) {
    const separator = rawKey.indexOf('.');
    if (separator <= 0 || separator >= rawKey.length - 1) {
        return null;
    }
    return {
        prefix: rawKey.slice(0, separator),
        secret: rawKey.slice(separator + 1),
    };
}

/**
 * One-way hash of the secret for storage and constant-time verification at auth time.
 * @param {string} secret
 * @returns {string}
 */
export function hashApiKeySecret(secret) {
    return hashSecret(secret);
}
