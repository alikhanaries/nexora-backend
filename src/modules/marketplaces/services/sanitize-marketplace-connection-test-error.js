const MAX_ERROR_LENGTH = 500;
const SECRET_PATTERN = /(?:shpat_|sk_live_|sk_test_|Atzr\|[\w|]+|Atza\|[\w|]+|AKIA[A-Z0-9]{8,}|-----BEGIN\s+[A-Z\s]+PRIVATE KEY-----|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key|password|Bearer\s+\S+|Cookie:\s*\S+)/gi;

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
