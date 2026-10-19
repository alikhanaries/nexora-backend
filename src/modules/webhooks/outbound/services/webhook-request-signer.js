import { createHmac } from 'node:crypto';

export const WEBHOOK_SIGNATURE_VERSION = 'v1';
export const WEBHOOK_SIGNATURE_HEADER = 'X-Nexora-Signature';
export const WEBHOOK_EVENT_HEADER = 'X-Nexora-Event';
export const WEBHOOK_EVENT_ID_HEADER = 'X-Nexora-Event-Id';
export const WEBHOOK_DELIVERY_ID_HEADER = 'X-Nexora-Delivery-Id';

/**
 * Computes the webhook HMAC signature over the exact request body bytes.
 *
 * Format: `v1=<lowercase-hex-hmac-sha256>`
 *
 * @param {string} secret
 * @param {string} body
 */
export function signWebhookRequestBody(secret, body) {
    const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    return `${WEBHOOK_SIGNATURE_VERSION}=${digest}`;
}

/**
 * @param {string} secret
 * @param {string} body
 * @param {string} signatureHeader
 */
export function verifyWebhookRequestBody(secret, body, signatureHeader) {
    const expected = signWebhookRequestBody(secret, body);
    return timingSafeEqual(expected, signatureHeader.trim());
}

/**
 * @param {string} left
 * @param {string} right
 */
function timingSafeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}
