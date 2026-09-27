import { createHmac, timingSafeEqual } from 'node:crypto';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';

/**
 * @param {object} input
 * @param {string} input.rawBody
 * @param {string|null|undefined} input.hmacHeader
 * @param {string} input.webhookSecret
 */
export function verifyShopifyWebhookHmac(input) {
    const secret = input.webhookSecret.trim();
    if (secret.length === 0) {
        throw new MarketplaceValidationError('Shopify webhook secret is not configured');
    }
    const header = typeof input.hmacHeader === 'string' ? input.hmacHeader.trim() : '';
    if (header.length === 0) {
        throw new MarketplaceValidationError('Shopify webhook HMAC header is missing');
    }
    const digest = createHmac('sha256', secret).update(input.rawBody, 'utf8').digest('base64');
    const expected = Buffer.from(digest, 'utf8');
    const received = Buffer.from(header, 'utf8');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        throw new MarketplaceValidationError('Shopify webhook signature is invalid');
    }
}
