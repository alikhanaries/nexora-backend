import { validateOutboundWebhookUrl } from '../../../shared/security/ssrf-validator.js';

/**
 * Validates subscription URL shape and SSRF safety for persistence.
 *
 * @param {string} rawUrl
 * @returns {Promise<string>}
 */
export async function validateWebhookUrl(rawUrl) {
    const url = await validateOutboundWebhookUrl(rawUrl);
    return url.toString();
}
