import { createHash } from 'node:crypto';

/**
 * Resolves an idempotency key for StockConnect CE compatibility mutations.
 * Preserves explicit Idempotency-Key when provided; otherwise derives a deterministic key.
 *
 * @param {{
 *   header: string | string[] | undefined;
 *   tenantId: string;
 *   routeId: string;
 *   fingerprint: string;
 * }} input
 */
export function resolveStockConnectCeIdempotencyKey(input) {
    const rawHeader = Array.isArray(input.header) ? input.header[0] : input.header;
    if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
        return rawHeader.trim();
    }
    const digest = createHash('sha256')
        .update(`${input.tenantId}\0${input.routeId}\0${input.fingerprint}`)
        .digest('hex');
    return `ce-compat:${digest}`;
}

/**
 * Stable JSON fingerprint for idempotency derivation (sorted keys).
 *
 * @param {unknown} value
 */
export function stableIdempotencyFingerprint(value) {
    return JSON.stringify(sortValue(value));
}

function sortValue(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((entry) => sortValue(entry));
    }
    const record = /** @type {Record<string, unknown>} */ (value);
    const sorted = {};
    for (const key of Object.keys(record).sort()) {
        sorted[key] = sortValue(record[key]);
    }
    return sorted;
}
