import { describe, expect, it } from 'vitest';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { MarketplaceWebhookUnsupportedError } from '../../../src/modules/marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { normalizedMarketplaceWebhookEventSchema } from '../../../src/modules/marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js';
import { AmazonWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-webhook-adapter.js';
import { buildAmazonOrderChangeNotification, wrapAmazonNotificationInSns } from './amazon-order-change-fixtures.js';

const connection = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    channelId: '00000000-0000-4000-8000-000000000002',
    marketplaceKey: 'amazon',
    connectionId: '00000000-0000-4000-8000-000000000099',
};

describe('AmazonWebhookAdapter', () => {
    it('supports inbound webhooks', () => {
        const adapter = new AmazonWebhookAdapter();
        expect(adapter.getWebhookCapabilities().supportsInboundWebhooks).toBe(true);
    });

    it('normalizes SNS-wrapped ORDER_CHANGE to order.update lifecycle payload', async () => {
        const adapter = new AmazonWebhookAdapter();
        const rawBody = wrapAmazonNotificationInSns(buildAmazonOrderChangeNotification());
        await adapter.authenticateWebhookRequest({ headers: {}, rawBody, connection });
        const event = await adapter.normalizeWebhookEvent({ headers: {}, rawBody, connection });
        expect(event.eventKind).toBe(MarketplaceWebhookEventKind.ORDER_UPDATE);
        expect(event.deduplicationKey).toBe('e9b0f384-aaaa-bbbb-cccc-dddddddddddd');
        expect(normalizedMarketplaceWebhookEventSchema.parse(event).resource.type).toBe('order');
    });

    it('rejects unsupported Amazon notification types', async () => {
        const adapter = new AmazonWebhookAdapter();
        const rawBody = wrapAmazonNotificationInSns({
            NotificationType: 'FEED_PROCESSING_FINISHED',
            Payload: {},
        });
        await adapter.authenticateWebhookRequest({ headers: {}, rawBody, connection });
        await expect(adapter.normalizeWebhookEvent({ headers: {}, rawBody, connection }))
            .rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });

    it('rejects SNS subscription confirmation handshakes', async () => {
        const adapter = new AmazonWebhookAdapter();
        const rawBody = JSON.stringify({
            Type: 'SubscriptionConfirmation',
            Message: 'confirm',
        });
        await expect(adapter.authenticateWebhookRequest({ headers: {}, rawBody, connection }))
            .rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });
});
