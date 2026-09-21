import { ValidationError } from '../errors/index.js';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
export function clampCursorLimit(limit) {
    const requested = limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(requested) || requested < 1) {
        throw new ValidationError('Limit must be a positive integer');
    }
    return Math.min(requested, MAX_LIMIT);
}
/** Encodes a cursor from sort key components (opaque to clients). */
export function encodeCursor(parts) {
    return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}
export function decodeCursor(cursor) {
    try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
            throw new ValidationError('Invalid cursor');
        }
        return parsed;
    }
    catch {
        throw new ValidationError('Invalid cursor');
    }
}
