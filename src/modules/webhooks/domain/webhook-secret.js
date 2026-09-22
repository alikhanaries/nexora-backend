import { randomBytes } from 'node:crypto';

/** Generates a webhook signing secret shown once at subscription creation. */
export function generateWebhookSecret() {
    return randomBytes(32).toString('base64url');
}
