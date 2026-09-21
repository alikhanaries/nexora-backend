import { ValidationError } from '../errors/index.js';

export function requireIdempotencyKey(header) {
    const value = Array.isArray(header) ? header[0] : header;
    if (value === undefined || value.trim().length === 0) {
        throw new ValidationError('Idempotency-Key header is required');
    }
    return value.trim();
}
