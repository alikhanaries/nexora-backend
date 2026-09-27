import { createHmac } from 'node:crypto';
import { MarketplaceWebhookAuthenticationError } from '../../src/modules/marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { MarketplaceWebhookEventKind } from '../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { NormalizedMarketplaceOrderStatus } from '../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-order-status.js';

export const TEST_WEBHOOK_HMAC_SECRET = 'phase-32-test-webhook-secret';

/** @param {string} rawBody */
export function signTestWebhookBody(rawBody) {
    return createHmac('sha256', TEST_WEBHOOK_HMAC_SECRET).update(rawBody, 'utf8').digest('hex');
}

/**
 * @param {string} marketplaceKey
 * @param {object} [options]
 * @param {boolean} [options.invalidSignature]
 * @param {boolean} [options.unsupportedEventKind]
 * @param {() => never} [options.onNormalize]
 */
export function createTestMarketplaceWebhookAdapter(marketplaceKey, options = {}) {
    return {
        marketplaceKey,
        getWebhookCapabilities: () => ({ supportsInboundWebhooks: true }),
        authenticateWebhookRequest: async (context) => {
            const provided = context.headers['x-test-signature'];
            const expected = signTestWebhookBody(context.rawBody);
            if (options.invalidSignature === true || provided !== expected) {
                throw new MarketplaceWebhookAuthenticationError();
            }
        },
        normalizeWebhookEvent: async (context) => {
            if (options.onNormalize !== undefined) {
                return options.onNormalize(context);
            }
            const parsed = JSON.parse(context.rawBody);
            const eventKind = options.unsupportedEventKind === true
                ? MarketplaceWebhookEventKind.ORDER_UPDATE
                : MarketplaceWebhookEventKind.ORDER_CREATE;
            return {
                deduplicationKey: parsed.deduplicationKey,
                eventKind,
                marketplaceKey,
                resource: {
                    type: 'order',
                    order: parsed.order,
                },
            };
        },
    };
}

/**
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {string} input.externalOrderId
 * @param {string} input.merchantSku
 * @param {string} input.stockLocationId
 */
export function buildTestWebhookPayload(input) {
    return {
        deduplicationKey: input.externalOrderId,
        order: {
            externalOrderId: input.externalOrderId,
            marketplaceKey: input.marketplaceKey,
            status: NormalizedMarketplaceOrderStatus.CONFIRMED,
            currency: 'USD',
            lines: [{
                merchantSku: input.merchantSku,
                quantity: 1,
                stockLocationId: input.stockLocationId,
            }],
        },
    };
}
