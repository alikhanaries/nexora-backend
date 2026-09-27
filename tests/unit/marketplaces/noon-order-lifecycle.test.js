import { describe, expect, it, vi } from 'vitest';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { NoonOrderAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-order-adapter.js';
import { mapNoonFbpiOrderToLifecycleCommand } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/map-noon-fbpi-order-to-lifecycle-command.js';
import {
    deriveNoonOrderLifecycleTargetFromItems,
    mapNoonMpItemStatusToLifecycleTarget,
} from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-order-status.js';
import { MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { buildNoonFbpiOrderSyncEvent, buildNoonGetFbpiOrderResponse } from './noon-event-fixtures.js';

const lifecycleContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    channelId: '00000000-0000-4000-8000-000000000002',
    marketplaceKey: 'noon',
};

const runtime = {
    marketplaceKey: 'noon',
    configuration: { countryCode: 'ae', warehouseCode: 'WH-1' },
    credentials: {},
    connectionRequired: true,
};

describe('mapNoonMpItemStatusToLifecycleTarget', () => {
    it('maps confirmed and cancelled item statuses', () => {
        expect(mapNoonMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_CONFIRMED'))
            .toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
        expect(mapNoonMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_CANCELLED'))
            .toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
    });

    it('rejects unknown mp_status values', () => {
        expect(() => mapNoonMpItemStatusToLifecycleTarget('MP_ITEM_STATUS_OTHER'))
            .toThrow(MarketplaceValidationError);
    });
});

describe('mapNoonFbpiOrderToLifecycleCommand', () => {
    it('maps confirmed FBPI order to status_sync', () => {
        const command = mapNoonFbpiOrderToLifecycleCommand({
            marketplaceKey: 'noon',
            externalEventId: 'msg-noon-abc123',
            orderPayload: buildNoonGetFbpiOrderResponse(),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.externalOrderId).toBe('NFBO123456789');
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });

    it('maps fully cancelled FBPI order to cancel_order', () => {
        const command = mapNoonFbpiOrderToLifecycleCommand({
            marketplaceKey: 'noon',
            externalEventId: 'evt-cancel-1',
            orderPayload: buildNoonGetFbpiOrderResponse({
                items: [{
                    mp_item_nr: 'NFBO123456789-1',
                    partner_sku: 'MY-SKU-001',
                    mp_status: 'MP_ITEM_STATUS_CANCELLED',
                    integration_status: 'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED',
                }],
            }),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.CANCEL_ORDER);
        expect(command.lines).toEqual([{
            merchantSku: 'MY-SKU-001',
            externalLineId: 'NFBO123456789-1',
            quantity: 1,
        }]);
    });

    it('maps shipped integration status to unknown target', () => {
        expect(deriveNoonOrderLifecycleTargetFromItems([{
            mp_status: 'MP_ITEM_STATUS_CONFIRMED',
            integration_status: 'INTEGRATION_ITEM_STATUS_SHIPPED',
        }])).toBe(NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN);
    });
});

describe('NoonOrderAdapter', () => {
    it('declares lifecycle capabilities aligned with FBPI APIs', () => {
        const adapter = new NoonOrderAdapter();
        const caps = adapter.getOrderLifecycleCapabilities();
        expect(caps.supportsOrderStatusSync).toBe(true);
        expect(caps.supportsOrderCancel).toBe(true);
        expect(caps.supportsOrderFulfill).toBe(false);
        expect(caps.supportsOrderUpdate).toBe(false);
    });

    it('fetches GetFbpiOrder when normalizing FBPI::ORDER_SYNC webhook payload', async () => {
        const getFbpiOrder = vi.fn(async () => ({
            json: buildNoonGetFbpiOrderResponse(),
        }));
        const adapter = new NoonOrderAdapter({
            api: { getFbpiOrder },
        });
        const command = await adapter.normalizeLifecycleCommand({
            noonEvent: buildNoonFbpiOrderSyncEvent(),
        }, runtime, lifecycleContext);
        expect(getFbpiOrder).toHaveBeenCalledWith(runtime, 'NFBO123456789');
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.externalEventId).toBe('msg-noon-abc123');
    });

    it('fetchOrderLifecycleCommand uses GetFbpiOrder', async () => {
        const getFbpiOrder = vi.fn(async () => ({
            json: buildNoonGetFbpiOrderResponse(),
        }));
        const adapter = new NoonOrderAdapter({
            api: { getFbpiOrder },
        });
        const command = await adapter.fetchOrderLifecycleCommand(runtime, {
            ...lifecycleContext,
            externalOrderId: 'NFBO123456789',
            stockLocationId: '00000000-0000-4000-8000-000000000099',
            correlationId: null,
        }, 'poll-1');
        expect(command.externalEventId).toBe('poll-1');
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });
});
