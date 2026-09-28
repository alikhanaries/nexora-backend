/**
 * Reads merchant API keys from query parameters (`apiKey` / `apikey`).
 *
 * @param {Record<string, unknown>|undefined} query
 * @returns {string|null}
 */
export function readMerchantCompatQueryApiKey(query) {
    if (query === undefined || query === null) {
        return null;
    }
    const candidates = [query.apiKey, query.apikey];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
        if (Array.isArray(candidate) && typeof candidate[0] === 'string' && candidate[0].trim().length > 0) {
            return candidate[0].trim();
        }
    }
    return null;
}
