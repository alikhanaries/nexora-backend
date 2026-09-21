import { randomBytes } from 'node:crypto';
import { hashSecret } from '../../../shared/security/index.js';
const PREFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function generateApiKeyPrefix() {
    let suffix = '';
    for (let index = 0; index < 8; index += 1) {
        suffix += PREFIX_CHARS[randomBytes(1)[0] % PREFIX_CHARS.length];
    }
    return `nxk_${suffix}`;
}
export function generateApiKeySecret() {
    return randomBytes(32).toString('base64url');
}
export function formatApiKey(prefix, secret) {
    return `${prefix}.${secret}`;
}
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
export function hashApiKeySecret(secret) {
    return hashSecret(secret);
}
