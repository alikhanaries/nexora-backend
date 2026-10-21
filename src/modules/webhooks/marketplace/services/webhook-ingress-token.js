import { createHash, randomBytes } from 'node:crypto';

/** @param {string} token */
export function hashWebhookIngressToken(token) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Issues opaque token embedded in marketplace webhook URL (tenant/channel binding).
 */
export function generateWebhookIngressToken() {
    return randomBytes(32).toString('base64url');
}
