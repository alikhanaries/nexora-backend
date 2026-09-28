import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EnsureMarketplaceOrderIngestedFromLifecycle } from '../../../src/modules/marketplace-order-ingestion/application/ensure-marketplace-order-ingested-from-lifecycle.js';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';

describe('EnsureMarketplaceOrderIngestedFromLifecycle', () => {
    const tenantId = randomUUID();
    const channelId = randomUUID();
    const externalOrderId = 'fbpi-order-1';

    function buildCommand() {
        return {
            operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
            externalOrderId,
            externalEventId: 'evt-1',
            targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
        };
    }

    it('skips ingest when order already exists', async () => {
        const existingOrderId = randomUUID();
        const orders = {
            findByChannelAndExternalReference: vi.fn(async () => ({ id: existingOrderId })),
        };
        const ingestNormalizedMarketplaceOrder = { execute: vi.fn() };
        const service = new EnsureMarketplaceOrderIngestedFromLifecycle({
            ingestNormalizedMarketplaceOrder,
            orderAdapterRegistry: { resolve: vi.fn() },
            channelQueryService: { getChannelById: vi.fn() },
            orders,
            database: { execute: vi.fn(async (work) => work({})) },
        });
        const result = await service.execute({
            tenantId,
            channelId,
            marketplaceKey: 'noon',
            payload: {},
            command: buildCommand(),
        });
        expect(result).toEqual({ ingested: false, orderId: existingOrderId });
        expect(ingestNormalizedMarketplaceOrder.execute).not.toHaveBeenCalled();
    });

    it('ingests when order is missing and adapter returns normalized order', async () => {
        const newOrderId = randomUUID();
        const normalizedOrder = {
            externalOrderId,
            marketplaceKey: 'noon',
            status: 'PENDING',
            currency: 'SAR',
            lines: [{ merchantSku: 'SKU-1', quantity: 1, stockLocationId: randomUUID() }],
        };
        const adapter = {
            normalizeOrderFromLifecyclePayload: vi.fn(async () => normalizedOrder),
        };
        const ingestNormalizedMarketplaceOrder = {
            execute: vi.fn(async () => ({ outcome: 'created', order: { id: newOrderId } })),
        };
        const service = new EnsureMarketplaceOrderIngestedFromLifecycle({
            ingestNormalizedMarketplaceOrder,
            orderAdapterRegistry: { resolve: vi.fn(() => adapter) },
            channelQueryService: {
                getChannelById: vi.fn(async () => ({
                    id: channelId,
                    defaultStockLocationId: randomUUID(),
                })),
            },
            orders: { findByChannelAndExternalReference: vi.fn(async () => null) },
            database: { execute: vi.fn(async (work) => work({})) },
        });
        const result = await service.execute({
            tenantId,
            channelId,
            marketplaceKey: 'noon',
            payload: { noonEvent: {} },
            command: buildCommand(),
            jobId: 'job-1',
        });
        expect(result.ingested).toBe(true);
        expect(result.orderId).toBe(newOrderId);
        expect(ingestNormalizedMarketplaceOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId,
            channelId,
            marketplaceKey: 'noon',
            normalizedOrder,
            jobId: 'job-1',
        }));
    });

    it('isolates lookup by tenant and channel', async () => {
        const orders = {
            findByChannelAndExternalReference: vi.fn(async () => null),
        };
        const adapter = {
            normalizeOrderFromLifecyclePayload: vi.fn(async () => ({
                externalOrderId,
                marketplaceKey: 'namshi',
                status: 'PENDING',
                currency: 'SAR',
                lines: [{ merchantSku: 'X', quantity: 1, stockLocationId: randomUUID() }],
            })),
        };
        const ingestNormalizedMarketplaceOrder = {
            execute: vi.fn(async () => ({ outcome: 'created', order: { id: randomUUID() } })),
        };
        const service = new EnsureMarketplaceOrderIngestedFromLifecycle({
            ingestNormalizedMarketplaceOrder,
            orderAdapterRegistry: { resolve: vi.fn(() => adapter) },
            channelQueryService: {
                getChannelById: vi.fn(async () => ({ id: channelId, defaultStockLocationId: randomUUID() })),
            },
            orders,
            database: { execute: vi.fn(async (work) => work({})) },
        });
        await service.execute({
            tenantId,
            channelId,
            marketplaceKey: 'namshi',
            payload: {},
            command: buildCommand(),
        });
        expect(orders.findByChannelAndExternalReference).toHaveBeenCalledWith(
            expect.anything(),
            tenantId,
            channelId,
            externalOrderId,
        );
    });
});
