import { describe, expect, it, vi } from 'vitest';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { AmazonOrderAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-order-adapter.js';
import { mapAmazonOrderStatusToLifecycleTarget } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/amazon-order-status.js';
import { mapAmazonOrderChangeToLifecycleCommand } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/map-amazon-order-change-to-lifecycle-command.js';
import { mapAmazonSpApiOrderToLifecycleCommand } from '../../../src/modules/marketplaces/infrastructure/adapters/amazon/map-amazon-sp-api-order-to-lifecycle-command.js';
import { MarketplaceValidationError } from '../../../src/modules/marketplaces/domain/marketplace-errors.js';
import { buildAmazonOrderChangeNotification } from './amazon-order-change-fixtures.js';

describe('mapAmazonOrderStatusToLifecycleTarget', () => {
    it('maps canceled Amazon status to cancelled', () => {
        expect(mapAmazonOrderStatusToLifecycleTarget('Canceled')).toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
    });

    it('maps unshipped to confirmed', () => {
        expect(mapAmazonOrderStatusToLifecycleTarget('Unshipped')).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });

    it('maps shipped to unknown until fulfillment executor exists', () => {
        expect(mapAmazonOrderStatusToLifecycleTarget('Shipped')).toBe(NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN);
    });
});

describe('mapAmazonOrderChangeToLifecycleCommand', () => {
    it('maps ORDER_CHANGE status sync with notification id as externalEventId', () => {
        const command = mapAmazonOrderChangeToLifecycleCommand({
            marketplaceKey: 'amazon',
            notification: buildAmazonOrderChangeNotification(),
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.externalOrderId).toBe('123-4567890-1234567');
        expect(command.externalEventId).toBe('e9b0f384-aaaa-bbbb-cccc-dddddddddddd');
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED);
    });

    it('maps buyer-requested cancel to cancel_order with line hints', () => {
        const notification = buildAmazonOrderChangeNotification({
            Payload: {
                OrderChangeNotification: {
                    ...buildAmazonOrderChangeNotification().Payload.OrderChangeNotification,
                    OrderChangeType: 'BuyerRequestedChange',
                    Summary: {
                        ...buildAmazonOrderChangeNotification().Payload.OrderChangeNotification.Summary,
                        OrderItems: [{
                            OrderItemId: 'line-1',
                            SellerSKU: 'SKU-A',
                            Quantity: 1,
                            IsBuyerRequestedCancel: true,
                        }],
                    },
                },
            },
        });
        const command = mapAmazonOrderChangeToLifecycleCommand({
            marketplaceKey: 'amazon',
            notification,
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.CANCEL_ORDER);
        expect(command.lines).toEqual([{ merchantSku: 'SKU-A', externalLineId: 'line-1', quantity: 1 }]);
    });

    it('rejects unsupported notification types', () => {
        expect(() => mapAmazonOrderChangeToLifecycleCommand({
            marketplaceKey: 'amazon',
            notification: { NotificationType: 'ANY_OFFER_CHANGED' },
        })).toThrow(MarketplaceValidationError);
    });
});

describe('mapAmazonSpApiOrderToLifecycleCommand', () => {
    it('maps getOrder payload to status_sync', () => {
        const command = mapAmazonSpApiOrderToLifecycleCommand({
            marketplaceKey: 'amazon',
            externalEventId: 'poll-evt-1',
            orderPayload: {
                payload: {
                    Order: {
                        AmazonOrderId: '408-9812214-5408368',
                        OrderStatus: 'Canceled',
                        PurchaseDate: '2025-04-04T11:44:25.148Z',
                    },
                },
            },
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
    });
});

describe('AmazonOrderAdapter', () => {
    it('declares lifecycle capabilities aligned with SP-API and generic executor', () => {
        const adapter = new AmazonOrderAdapter();
        const caps = adapter.getOrderLifecycleCapabilities();
        expect(caps.supportsOrderStatusSync).toBe(true);
        expect(caps.supportsOrderCancel).toBe(true);
        expect(caps.supportsOrderFulfill).toBe(false);
        expect(caps.supportsOrderUpdate).toBe(false);
    });

    it('normalizeLifecycleCommand delegates to ORDER_CHANGE mapper', async () => {
        const adapter = new AmazonOrderAdapter();
        const command = await adapter.normalizeLifecycleCommand({
            notification: buildAmazonOrderChangeNotification(),
        }, undefined, {
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'amazon',
        });
        expect(command.operation).toBe(MarketplaceOrderLifecycleOperation.STATUS_SYNC);
    });

    it('fetches order via SP-API when source is sp_api_get_order', async () => {
        const getOrder = vi.fn(async () => ({
            json: {
                payload: {
                    Order: {
                        AmazonOrderId: '123-4567890-1234567',
                        OrderStatus: 'Canceled',
                    },
                },
            },
        }));
        const adapter = new AmazonOrderAdapter({
            spApi: { getOrder, confirmShipment: vi.fn() },
        });
        const command = await adapter.normalizeLifecycleCommand({
            source: 'sp_api_get_order',
            amazonOrderId: '123-4567890-1234567',
            externalEventId: 'sync-1',
        }, {
            marketplaceKey: 'amazon',
            connectionRequired: true,
            credentials: {},
            configuration: {},
        }, {
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'amazon',
        });
        expect(getOrder).toHaveBeenCalledOnce();
        expect(command.targetStatus).toBe(NormalizedMarketplaceLifecycleTargetStatus.CANCELLED);
    });
});
