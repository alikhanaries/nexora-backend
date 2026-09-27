import { describe, expect, it } from 'vitest';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { MarketplaceWebhookUnsupportedError } from '../../../src/modules/marketplace-webhook-ingestion/application/marketplace-webhook-errors.js';
import { normalizedMarketplaceWebhookEventSchema } from '../../../src/modules/marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js';
import { NoonWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-webhook-adapter.js';
import { buildNoonFbpiOrderSyncEvent } from './noon-event-fixtures.js';

const connection = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    channelId: '00000000-0000-4000-8000-000000000002',
    marketplaceKey: 'noon',
    connectionId: '00000000-0000-4000-8000-000000000099',
};

describe('NoonWebhookAdapter', () => {
    it('supports inbound webhooks', () => {
        const adapter = new NoonWebhookAdapter();
        expect(adapter.getWebhookCapabilities().supportsInboundWebhooks).toBe(true);
    });

    it('normalizes FBPI::ORDER_SYNC to order.update lifecycle payload', async () => {
        const adapter = new NoonWebhookAdapter();
        const rawBody = JSON.stringify(buildNoonFbpiOrderSyncEvent());
        await adapter.authenticateWebhookRequest({ headers: {}, rawBody, connection });
        const event = await adapter.normalizeWebhookEvent({ headers: {}, rawBody, connection });
        expect(event.eventKind).toBe(MarketplaceWebhookEventKind.ORDER_UPDATE);
        expect(event.deduplicationKey).toBe('msg-noon-abc123');
        expect(normalizedMarketplaceWebhookEventSchema.parse(event).resource.type).toBe('order');
    });

    it('rejects unsupported Noon event types', async () => {
        const adapter = new NoonWebhookAdapter();
        const rawBody = JSON.stringify(buildNoonFbpiOrderSyncEvent({ event_type: 'FBPO::PO_SYNC' }));
        await adapter.authenticateWebhookRequest({ headers: {}, rawBody, connection });
        await expect(adapter.normalizeWebhookEvent({ headers: {}, rawBody, connection }))
            .rejects.toBeInstanceOf(MarketplaceWebhookUnsupportedError);
    });
});
