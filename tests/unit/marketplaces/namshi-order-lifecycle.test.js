import { describe, expect, it, vi } from 'vitest';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { MarketplaceWebhookEventKind } from '../../../src/modules/marketplace-webhook-ingestion/domain/marketplace-webhook-event-kind.js';
import { normalizedMarketplaceWebhookEventSchema } from '../../../src/modules/marketplace-webhook-ingestion/application/normalized-marketplace-webhook-event.schema.js';
import { MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { NamshiOrderAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-order-adapter.js';
import { NamshiWebhookAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-webhook-adapter.js';
import {
    buildNamshiFbpiLifecycleEventId,
    mapNamshiFbpiOrderToLifecycleCommand,
} from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/map-namshi-fbpi-order-to-lifecycle-command.js';
import { deriveNamshiFbpiOrderTargetStatus, mapNamshiFbpiMpItemStatusToLifecycleTarget } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-fbpi-order-status.js';
import { parseNamshiFbpiWebhookEvent } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/parse-namshi-fbpi-webhook-event.js';
import { buildNamshiFbpiGetOrderResponse, buildNamshiFbpiOrderSyncWebhook } from './namshi-fbpi-fixtures.js';

describe('mapNamshiFbpiMpItemStatusToLifecycleTarget', () => {
    it('maps confirmed and cancelled mp_status values', () => {
        expect(mapNamshiFbpiMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_CONFIRMED'))
            .toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
        expect(mapNamshiFbpiMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_CANCELLED'))
            .toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
        expect(mapNamshiFbpiMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_UNSPECIFIED'))
            .toBe(NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN);
    });
});

describe('mapNamshiFbpiOrderToLifecycleCommand', () => {
    it('maps confirmed Namshi FBPI order to status_sync', () => {
        const command = mapNamshiFbpiOrderToLifecycleCommand({
            marketplaceKey: 'namshi',
            externalEventId: 'msg-namshi-001',
            orderPayload: buildNamshiFbpiGetOrderResponse(),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.externalOrderId).toBe('NFBO123456789');
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });

    it('rejects noon mp_code on Namshi channel mapping', () => {
        expect(() => mapNamshiFbpiOrderToLifecycleCommand({
            marketplaceKey: 'namshi',
            externalEventId: 'evt-1',
            orderPayload: buildNamshiFbpiGetOrderResponse({ mp_code: 'noon' }),
        })).toThrow(MarketplaceValidationError);
    });

    it('maps partial item cancellation to cancel_order with lines', () => {
        const command = mapNamshiFbpiOrderToLifecycleCommand({
            marketplaceKey: 'namshi',
            externalEventId: 'evt-partial',
            orderPayload: buildNamshiFbpiGetOrderResponse({
                items: [
                    {
                        mp_item_nr: 'NFBO123456789-1',
                        partner_sku: 'SKU-A',
                        mp_status: 'MP_ITEM_STATUS_CONFIRMED',
                        integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                    },
                    {
                        mp_item_nr: 'NFBO123456789-2',
                        partner_sku: 'SKU-B',
                        mp_status: 'MP_ITEM_STATUS_CANCELLED',
                        integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                    },
                ],
            }),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.CANCEL_ORDER);
        expect(command.lines).toEqual([{ merchantSku: 'SKU-B', externalLineId: 'NFBO123456789-2', quantity: 1 }]);
    });

    it('maps fully cancelled order to status_sync cancelled', () => {
        const command = mapNamshiFbpiOrderToLifecycleCommand({
            marketplaceKey: 'namshi',
            externalEventId: 'evt-full-cancel',
            orderPayload: buildNamshiFbpiGetOrderResponse({
                items: [{
                    mp_item_nr: 'NFBO123456789-1',
                    partner_sku: 'SKU-A',
                    mp_status: 'MP_ITEM_STATUS_CANCELLED',
                    integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                }],
            }),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
    });

    it('maps all shipped integration statuses to unknown target', () => {
        expect(deriveNamshiFbpiOrderTargetStatus([{
            mp_status: 'MP_ITEM_STATUS_CONFIRMED',
            integration_status: 'INTEGRATION_ITEM_STATUS_SHIPPED',
        }])).toBe(NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN);
    });
});

describe('buildNamshiFbpiLifecycleEventId', () => {
    it('prefers provider message_id', () => {
        expect(buildNamshiFbpiLifecycleEventId({
            messageId: 'msg-namshi-001',
            orderNr: 'NFBO123456789',
            publishedAt: '2026-04-09T08:42:15Z',
            eventType: 'FBPI::ORDER_SYNC',
        })).toBe('msg-namshi-001');
    });

    it('falls back to deterministic composite id', () => {
        expect(buildNamshiFbpiLifecycleEventId({
            messageId: null,
            orderNr: 'NFBO123456789',
            publishedAt: '2026-04-09T08:42:15Z',
            eventType: 'FBPI::ORDER_SYNC',
        })).toBe('FBPI::ORDER_SYNC:NFBO123456789:2026-04-09T08:42:15Z');
    });
});

describe('parseNamshiFbpiWebhookEvent', () => {
    it('parses ORDER_SYNC webhook payload', () => {
        const parsed = parseNamshiFbpiWebhookEvent(buildNamshiFbpiOrderSyncWebhook());
        expect(parsed.orderNr).toBe('NFBO123456789');
        expect(parsed.messageId).toBe('msg-namshi-001');
    });
});

describe('NamshiWebhookAdapter', () => {
    it('normalizes FBPI ORDER_SYNC to lifecycle webhook event', async () => {
        const adapter = new NamshiWebhookAdapter();
        const event = await adapter.normalizeWebhookEvent({
            rawBody: JSON.stringify(buildNamshiFbpiOrderSyncWebhook()),
            headers: {},
            connection: {
                tenantId: '00000000-0000-4000-8000-000000000001',
                channelId: '00000000-0000-4000-8000-000000000002',
                marketplaceKey: 'namshi',
                connectionId: '00000000-0000-4000-8000-000000000099',
            },
        });
        expect(event.eventKind).toBe(MarketplaceWebhookEventKind.ORDER_UPDATE);
        expect(event.marketplaceKey).toBe('namshi');
        expect(normalizedMarketplaceWebhookEventSchema.parse(event)).toBeDefined();
    });
});

describe('NamshiOrderAdapter', () => {
    it('declares lifecycle capabilities aligned with FBPI and generic executor', () => {
        const adapter = new NamshiOrderAdapter();
        const caps = adapter.getOrderLifecycleCapabilities();
        expect(caps.supportsOrderStatusSync).toBe(true);
        expect(caps.supportsOrderCancel).toBe(true);
        expect(caps.supportsOrderFulfill).toBe(false);
        expect(caps.supportsOrderReturn).toBe(false);
    });

    it('fetches FBPI order when normalizing fbpi_order_sync payload', async () => {
        const getFbpiOrder = vi.fn(async () => ({
            json: buildNamshiFbpiGetOrderResponse(),
        }));
        const adapter = new NamshiOrderAdapter({
            api: { getFbpiOrder },
        });
        const command = await adapter.normalizeLifecycleCommand({
            source: 'fbpi_order_sync',
            event: buildNamshiFbpiOrderSyncWebhook(),
        }, {
            marketplaceKey: 'namshi',
            credentials: {},
            configuration: {},
        }, {
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
        });
        expect(getFbpiOrder).toHaveBeenCalledOnce();
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
    });

    it('fetchOrderLifecycleCommand loads order by external id', async () => {
        const getFbpiOrder = vi.fn(async () => ({
            json: buildNamshiFbpiGetOrderResponse(),
        }));
        const adapter = new NamshiOrderAdapter({
            api: { getFbpiOrder },
        });
        const command = await adapter.fetchOrderLifecycleCommand({
            marketplaceKey: 'namshi',
            credentials: {},
            configuration: {},
        }, {
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
            externalOrderId: 'NFBO123456789',
            stockLocationId: '00000000-0000-4000-8000-000000000099',
            correlationId: null,
        }, 'poll-evt-1');
        expect(command.externalEventId).toBe('poll-evt-1');
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });
});
