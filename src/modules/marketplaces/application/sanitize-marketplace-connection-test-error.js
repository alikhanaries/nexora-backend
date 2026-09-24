const MAX_ERROR_LENGTH = 500;
const SECRET_PATTERN = /(?:shpat_|sk_live_|sk_test_|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|password|Bearer\s+\S+)/gi;

/**
 * @param {unknown} error
 */
export function sanitizeMarketplaceConnectionTestError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = message.replace(SECRET_PATTERN, '[REDACTED]');
    return redacted.length > MAX_ERROR_LENGTH
        ? `${redacted.slice(0, MAX_ERROR_LENGTH)}…`
        : redacted;
}
