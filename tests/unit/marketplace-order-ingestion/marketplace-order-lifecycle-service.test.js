import { describe, expect, it, vi } from 'vitest';
import { MarketplaceOrderLifecycleService } from '../../../src/modules/marketplace-order-ingestion/application/marketplace-order-lifecycle-service.js';
import { ExecuteMarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/application/execute-marketplace-order-lifecycle-operation.js';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-operation.js';
import { MarketplaceOrderLifecycleOutcome } from '../../../src/modules/marketplace-order-ingestion/domain/marketplace-order-lifecycle-outcome.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../src/modules/marketplace-order-ingestion/domain/normalized-marketplace-lifecycle-target-status.js';
import { MarketplaceOrderAdapterRegistry } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-adapter-registry.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleUnsupportedError,
} from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { OrderStatus } from '../../../src/modules/orders/domain/order-status.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const channelId = '00000000-0000-4000-8000-000000000002';
const marketplaceKey = 'lifecycle-test';

function buildService(overrides = {}) {
    const registry = new MarketplaceOrderAdapterRegistry();
    registry.register({
        marketplaceKey,
        getOrderLifecycleCapabilities: () => ({
            supportsOrderUpdate: false,
            supportsOrderCancel: false,
            supportsOrderReturn: false,
            supportsOrderRefund: false,
            supportsOrderFulfill: false,
            supportsShipmentUpdate: false,
            supportsOrderStatusSync: true,
        }),
    });
    const order = {
        id: '00000000-0000-4000-8000-000000000099',
        tenantId,
        channelId,
        status: OrderStatus.NEW,
    };
    const executeOperation = new ExecuteMarketplaceOrderLifecycleOperation({
        orders: {
            listOrderLines: vi.fn(async () => []),
        },
        productQueryService: { getProductBySku: vi.fn() },
        confirmOrder: { execute: vi.fn(async () => ({ order: {} })) },
        cancellationCommandService: { createCancellation: vi.fn(async () => ({ cancellation: {} })) },
    });
    const service = new MarketplaceOrderLifecycleService({
        database: {
            execute: vi.fn(async (fn) => fn({})),
        },
        channelQueryService: {
            getChannelById: vi.fn(async () => ({
                tenantId,
                channelId,
                marketplaceId: '00000000-0000-4000-8000-000000000010',
            })),
        },
        marketplaceLookup: {
            findById: vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000010', key: marketplaceKey })),
        },
        orders: {
            findByChannelAndExternalReference: vi.fn(async () => order),
        },
        executeOperation,
        orderAdapterRegistry: registry,
        idempotency: {
            execute: vi.fn(async (_key, _fp, operation) => ({
                kind: 'executed',
                value: await operation({}),
            })),
        },
        ...overrides,
    });
    return { service, executeOperation, order, registry };
}

describe('MarketplaceOrderLifecycleService', () => {
    it('rejects unsupported lifecycle operations', async () => {
        const { service, registry } = buildService();
        registry.register({
            marketplaceKey,
            getOrderLifecycleCapabilities: () => ({
                supportsOrderUpdate: false,
                supportsOrderCancel: false,
                supportsOrderReturn: false,
                supportsOrderRefund: false,
                supportsOrderFulfill: false,
                supportsShipmentUpdate: false,
                supportsOrderStatusSync: false,
            }),
        });
        await expect(service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'ext-1',
                externalEventId: 'evt-1',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('rejects lifecycle for missing Nexora order', async () => {
        const { service } = buildService({
            orders: {
                findByChannelAndExternalReference: vi.fn(async () => null),
            },
        });
        await expect(service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'missing',
                externalEventId: 'evt-2',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecyclePermanentError);
    });

    it('rejects channel tenant mismatch', async () => {
        const { service } = buildService({
            channelQueryService: {
                getChannelById: vi.fn(async () => ({
                    tenantId: '00000000-0000-4000-8000-000000000099',
                    channelId,
                    marketplaceId: '00000000-0000-4000-8000-000000000010',
                })),
            },
        });
        await expect(service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'ext-1',
                externalEventId: 'evt-3',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecyclePermanentError);
    });

    it('rejects when resolved order belongs to another tenant', async () => {
        const { service } = buildService({
            orders: {
                findByChannelAndExternalReference: vi.fn(async () => ({
                    id: '00000000-0000-4000-8000-000000000099',
                    tenantId: '00000000-0000-4000-8000-000000000099',
                    channelId,
                    status: OrderStatus.NEW,
                })),
            },
        });
        await expect(service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'ext-1',
                externalEventId: 'evt-tenant-mismatch',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecyclePermanentError);
    });

    it('returns duplicate when idempotency replays', async () => {
        const { service } = buildService({
            idempotency: {
                execute: vi.fn(async () => ({
                    kind: 'replayed',
                    value: {
                        statusCode: 200,
                        body: { outcome: MarketplaceOrderLifecycleOutcome.APPLIED, orderId: '00000000-0000-4000-8000-000000000099' },
                    },
                })),
            },
        });
        const result = await service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'ext-1',
                externalEventId: 'evt-dup',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        });
        expect(result.outcome).toBe(MarketplaceOrderLifecycleOutcome.DUPLICATE);
    });

    it('applies status_sync confirm through executor', async () => {
        const { service, executeOperation } = buildService();
        const spy = vi.spyOn(executeOperation, 'execute');
        const result = await service.apply({
            tenantId,
            channelId,
            command: {
                operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
                marketplaceKey,
                externalOrderId: 'ext-1',
                externalEventId: 'evt-4',
                targetStatus: NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED,
            },
        });
        expect(spy).toHaveBeenCalled();
        expect(result.outcome).toBe(MarketplaceOrderLifecycleOutcome.APPLIED);
    });
});
