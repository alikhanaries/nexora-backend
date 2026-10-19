import { createHash, randomBytes } from 'node:crypto';

/** @param {string} token */
export function hashWebhookIngressToken(token) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateWebhookIngressToken() {
    return randomBytes(32).toString('base64url');
}
