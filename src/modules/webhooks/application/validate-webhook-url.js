import { ValidationError } from '../../../shared/errors/index.js';

/**
 * Validates subscription URL shape for persistence.
 *
 * SSRF protections for outbound HTTP delivery belong in the future delivery worker.
 */
export function validateWebhookUrl(rawUrl) {
    const url = rawUrl.trim();
    if (url.length === 0) {
        throw new ValidationError('Webhook URL is required');
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new ValidationError('Webhook URL must be a valid URL');
    }
    if (parsed.protocol !== 'https:') {
        throw new ValidationError('Webhook URL must use HTTPS');
    }
    return url;
}
