import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
/** Generates a cryptographically secure random token as hex. */
export function generateSecureToken(byteLength = 32) {
    return randomBytes(byteLength).toString('hex');
}
/** SHA-256 hash of a secret value for storage or lookup. */
export function hashSecret(value) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}
/** Constant-time comparison of two hex-encoded hashes. */
export function secureCompareHash(storedHash, candidateHash) {
    try {
        const a = Buffer.from(storedHash, 'hex');
        const b = Buffer.from(candidateHash, 'hex');
        if (a.length !== b.length)
            return false;
        return timingSafeEqual(a, b);
    }
    catch {
        return false;
    }
}
/** Constant-time comparison of two UTF-8 strings. */
export function secureCompareString(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length)
        return false;
    return timingSafeEqual(bufA, bufB);
}
