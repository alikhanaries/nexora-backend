const REDACTED = '[redacted]';

const SENSITIVE_KEY = /token|cookie|authorization|credential|private|secret|password|keyid|key_id|project/i;

/**
 * Extract allowlisted fields from Noon Partners-style error JSON (status_id, status_code, message, details).
 * Never returns raw bodies, credentials, or unbounded strings.
 *
 * @param {unknown} body
 * @param {{ maxMessageLength?: number, maxDetails?: number }} [options]
 */
export function extractSafeMarketplaceErrorDetail(body, options = {}) {
    const maxMessageLength = options.maxMessageLength ?? 500;
    const maxDetails = options.maxDetails ?? 8;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return null;
    }
    /** @type {Record<string, unknown>} */
    const record = body;
    /** @type {Record<string, unknown>} */
    const out = {};

    if (typeof record.status_id === 'number' && Number.isFinite(record.status_id)) {
        out.status_id = record.status_id;
    }
    if (typeof record.status_code === 'string') {
        out.status_code = truncateString(record.status_code, 120);
    }
    if (typeof record.message === 'string') {
        out.message = truncateString(record.message, maxMessageLength);
    }
    if (typeof record.error === 'string') {
        out.error = truncateString(record.error, 120);
    }
    if (typeof record.code === 'string') {
        out.code = truncateString(record.code, 120);
    }

    if (Array.isArray(record.details)) {
        out.details = record.details
            .slice(0, maxDetails)
            .map((item) => sanitizeDetailEntry(item))
            .filter((item) => item !== null);
        if (/** @type {unknown[]} */ (out.details).length === 0) {
            delete out.details;
        }
    }

    return Object.keys(out).length > 0 ? out : null;
}

/**
 * @param {unknown} item
 */
function sanitizeDetailEntry(item) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        if (typeof item === 'string') {
            return truncateString(item, 200);
        }
        return null;
    }
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, value] of Object.entries(item)) {
        if (SENSITIVE_KEY.test(key)) {
            out[key] = REDACTED;
            continue;
        }
        if (typeof value === 'string') {
            out[key] = truncateString(value, 300);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            out[key] = value;
        } else if (value !== null && typeof value === 'object') {
            out[key] = REDACTED;
        }
    }
    return Object.keys(out).length > 0 ? out : null;
}

/**
 * @param {string} value
 * @param {number} maxLen
 */
function truncateString(value, maxLen) {
    const trimmed = value.trim();
    if (trimmed.length <= maxLen) {
        return trimmed;
    }
    return `${trimmed.slice(0, maxLen)}…`;
}
