/**
 * Converts an HTTP Retry-After value (seconds) into a bounded delay in milliseconds.
 *
 * @param {number | null} retryAfterSeconds
 * @param {number} maxRetryAfterSeconds
 * @returns {number | null} delay ms when Retry-After is present, otherwise null
 */
export function resolveWebhookRetryDelayMs(retryAfterSeconds, maxRetryAfterSeconds) {
    if (retryAfterSeconds === null || retryAfterSeconds === undefined) {
        return null;
    }
    if (!Number.isInteger(retryAfterSeconds) || retryAfterSeconds < 0) {
        return null;
    }
    const cappedSeconds = Math.min(retryAfterSeconds, maxRetryAfterSeconds);
    return cappedSeconds * 1_000;
}
