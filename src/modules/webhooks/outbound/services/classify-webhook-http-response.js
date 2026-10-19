const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * @typedef {'success' | 'retryable_failure' | 'permanent_failure'} WebhookHttpOutcome
 */

/**
 * @typedef {object} WebhookHttpClassification
 * @property {WebhookHttpOutcome} outcome
 * @property {boolean} retryable
 */

/**
 * Classifies an HTTP response status for webhook delivery retry policy.
 *
 * @param {number} status
 * @returns {WebhookHttpClassification}
 */
export function classifyWebhookHttpResponse(status) {
    if (status >= 200 && status < 300) {
        return { outcome: 'success', retryable: false };
    }
    if (status >= 300 && status < 400) {
        return { outcome: 'permanent_failure', retryable: false };
    }
    if (RETRYABLE_STATUS_CODES.has(status)) {
        return { outcome: 'retryable_failure', retryable: true };
    }
    if (status >= 400 && status < 500) {
        return { outcome: 'permanent_failure', retryable: false };
    }
    if (status >= 500) {
        return { outcome: 'retryable_failure', retryable: true };
    }
    return { outcome: 'retryable_failure', retryable: true };
}

/**
 * @param {Record<string, string>} headers
 * @returns {number | null}
 */
export function parseRetryAfterSeconds(headers) {
    const value = headers['retry-after'] ?? headers['Retry-After'];
    if (value === undefined) {
        return null;
    }
    const seconds = Number.parseInt(value, 10);
    if (Number.isInteger(seconds) && seconds >= 0) {
        return seconds;
    }
    const date = Date.parse(value);
    if (Number.isNaN(date)) {
        return null;
    }
    return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
}
