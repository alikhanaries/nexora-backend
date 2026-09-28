/**
 * Redacts credentials from webhook destination URLs for structured logs.
 *
 * @param {string} url
 * @returns {{ destinationHost: string, destinationPath: string }|null}
 */
export function sanitizeWebhookDestinationForLog(url) {
    if (typeof url !== 'string' || url.trim().length === 0) {
        return null;
    }
    try {
        const parsed = new URL(url);
        return {
            destinationHost: parsed.host,
            destinationPath: parsed.pathname.length > 0 ? parsed.pathname : '/',
        };
    }
    catch {
        return { destinationHost: '(invalid-url)', destinationPath: '/' };
    }
}
