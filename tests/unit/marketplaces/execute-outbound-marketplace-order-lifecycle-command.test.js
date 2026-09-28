import { describe, expect, it, vi } from 'vitest';
import { MarketplaceOrderLifecycleOperation } from '../../../src/modules/marketplace-order-ingestion/index.js';
import {
    MarketplaceOrderLifecyclePermanentError,
    MarketplaceOrderLifecycleUnsupportedError,
} from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-lifecycle-errors.js';
import { ExecuteOutboundMarketplaceOrderLifecycleCommand } from '../../../src/modules/marketplaces/application/execute-outbound-marketplace-order-lifecycle-command.js';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../../../src/modules/marketplaces/application/marketplace-outbound-order-lifecycle-adapter-registry.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const channelId = '33333333-3333-4333-8333-333333333333';

function shopifyAdapter(overrides = {}) {
    return {
        marketplaceKey: 'shopify',
        getLifecycleCapabilities: () => ({
            supportsOutboundCancellation: true,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: false,
            supportsOutboundReturns: false,
        }),
        cancelOrder: vi.fn(async () => ({ outcome: 'cancelled', providerReference: 'ref-1' })),
        ...overrides,
    };
}

function buildCommand(deps) {
    const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
    registry.register(deps.adapter ?? shopifyAdapter());
    return new ExecuteOutboundMarketplaceOrderLifecycleCommand({
        lifecycleAdapterRegistry: registry,
        marketplaceAdapterRuntimeFactory: {
            createForSync: vi.fn(async () => ({
                marketplaceKey: 'shopify',
                credentials: {},
                configuration: {},
                connectionRequired: true,
            })),
        },
        database: {
            execute: vi.fn(async (fn) => fn({})),
        },
        idempotency: deps.idempotency,
        channelQueryService: deps.channelQueryService,
        marketplaceLookup: deps.marketplaceLookup,
        ...deps.extra,
    });
}

describe('ExecuteOutboundMarketplaceOrderLifecycleCommand', () => {
    it('rejects unsupported marketplace', async () => {
        const command = buildCommand({ adapter: shopifyAdapter() });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'amazon',
            externalOrderId: 'AMZ-1',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'k1',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('rejects unsupported operation for registered marketplace', async () => {
        const command = buildCommand({ adapter: shopifyAdapter() });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            operation: MarketplaceOrderLifecycleOperation.RETURN_ORDER,
            idempotencyKey: 'k2',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('executes cancel without holding adapter HTTP inside a DB transaction callback', async () => {
        const adapter = shopifyAdapter();
        const database = {
            execute: vi.fn(async (fn) => fn({})),
        };
        const command = buildCommand({ adapter, extra: { database } });
        const result = await command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'k3',
            payload: { restock: true },
        });
        expect(result.outcome).toBe('cancelled');
        expect(database.execute).toHaveBeenCalledTimes(1);
        expect(adapter.cancelOrder).toHaveBeenCalledTimes(1);
    });

    it('deduplicates via idempotency service', async () => {
        const adapter = shopifyAdapter();
        /** @type {{ statusCode: number, body: object } | undefined} */
        let stored;
        const idempotency = {
            execute: vi.fn(async (_key, _fingerprint, run) => {
                if (stored !== undefined) {
                    return { kind: 'replayed', value: stored };
                }
                const value = await run();
                stored = { statusCode: 200, body: value };
                return { kind: 'fresh', value: stored };
            }),
        };
        const command = buildCommand({ adapter, idempotency });
        const input = {
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'same-key',
        };
        await command.execute(input);
        await command.execute(input);
        expect(adapter.cancelOrder).toHaveBeenCalledTimes(1);
    });

    it('executes Amazon fulfill when adapter registered', async () => {
        const amazonAdapter = {
            marketplaceKey: 'amazon',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(async () => ({ outcome: 'fulfilled', providerReference: 'pkg-1' })),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(amazonAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: {
                createForSync: vi.fn(async () => ({
                    marketplaceKey: 'amazon',
                    credentials: {},
                    configuration: { marketplaceId: 'ATVPDKIKX0DER' },
                    connectionRequired: true,
                })),
            },
            database: { execute: vi.fn(async (fn) => fn({})) },
        });
        const result = await command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'amazon',
            externalOrderId: '123-4567890-1234567',
            operation: MarketplaceOrderLifecycleOperation.FULFILL_ORDER,
            idempotencyKey: 'amz-fulfill-1',
            payload: {
                lines: [{ externalLineItemId: '60696125413094', quantity: 1 }],
                trackingNumber: '1Z999',
                carrier: 'UPS',
            },
        });
        expect(result.outcome).toBe('fulfilled');
        expect(amazonAdapter.createFulfillment).toHaveBeenCalledTimes(1);
    });

    it('executes Noon fulfill when adapter registered', async () => {
        const noonAdapter = {
            marketplaceKey: 'noon',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(async () => ({ outcome: 'fulfilled', providerReference: 'nexora-abc' })),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(noonAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: {
                createForSync: vi.fn(async () => ({
                    marketplaceKey: 'noon',
                    credentials: {},
                    configuration: { countryCode: 'ae', warehouseCode: 'WH-1' },
                    connectionRequired: true,
                })),
            },
            database: { execute: vi.fn(async (fn) => fn({})) },
        });
        const result = await command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'noon',
            externalOrderId: 'NFBO123456789',
            operation: MarketplaceOrderLifecycleOperation.FULFILL_ORDER,
            idempotencyKey: 'noon-fulfill-1',
            payload: {
                lines: [{ externalLineItemId: 'NFBO123456789-1', quantity: 1 }],
                trackingNumber: 'AWB1',
                carrier: 'noon',
            },
        });
        expect(result.outcome).toBe('fulfilled');
        expect(noonAdapter.createFulfillment).toHaveBeenCalledTimes(1);
    });

    it('rejects Noon outbound cancel', async () => {
        const noonAdapter = {
            marketplaceKey: 'noon',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(noonAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: { createForSync: vi.fn() },
            database: { execute: vi.fn() },
        });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'noon',
            externalOrderId: 'NFBO123456789',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'noon-cancel-1',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('executes Namshi fulfill when adapter registered', async () => {
        const namshiAdapter = {
            marketplaceKey: 'namshi',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(async () => ({ outcome: 'fulfilled', providerReference: 'namshi-abc' })),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(namshiAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: {
                createForSync: vi.fn(async () => ({
                    marketplaceKey: 'namshi',
                    credentials: {},
                    configuration: { countryCode: 'ae', warehouseCode: 'WH-1' },
                    connectionRequired: true,
                })),
            },
            database: { execute: vi.fn(async (fn) => fn({})) },
        });
        const result = await command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'namshi',
            externalOrderId: 'NFBO987654321',
            operation: MarketplaceOrderLifecycleOperation.FULFILL_ORDER,
            idempotencyKey: 'namshi-fulfill-1',
            payload: {
                lines: [{ externalLineItemId: 'NFBO987654321-1', quantity: 1 }],
                trackingNumber: 'AWB1',
                carrier: 'noon',
            },
        });
        expect(result.outcome).toBe('fulfilled');
        expect(namshiAdapter.createFulfillment).toHaveBeenCalledTimes(1);
    });

    it('rejects Namshi outbound cancel', async () => {
        const namshiAdapter = {
            marketplaceKey: 'namshi',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(namshiAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: { createForSync: vi.fn() },
            database: { execute: vi.fn() },
        });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'namshi',
            externalOrderId: 'NFBO987654321',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'namshi-cancel-1',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('rejects Amazon outbound cancel', async () => {
        const amazonAdapter = {
            marketplaceKey: 'amazon',
            getLifecycleCapabilities: () => ({
                supportsOutboundCancellation: false,
                supportsOutboundRefund: false,
                supportsOutboundFulfillment: true,
                supportsOutboundReturns: false,
            }),
            createFulfillment: vi.fn(),
        };
        const registry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
        registry.register(amazonAdapter);
        const command = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
            lifecycleAdapterRegistry: registry,
            marketplaceAdapterRuntimeFactory: { createForSync: vi.fn() },
            database: { execute: vi.fn() },
        });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'amazon',
            externalOrderId: '123-4567890-1234567',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'amz-cancel-1',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecycleUnsupportedError);
    });

    it('rejects cross-tenant channel access', async () => {
        const command = buildCommand({
            adapter: shopifyAdapter(),
            channelQueryService: {
                getChannelById: vi.fn(async () => ({
                    tenantId: tenantB,
                    marketplaceId: 'mp-1',
                })),
            },
            marketplaceLookup: {
                findById: vi.fn(async () => ({ id: 'mp-1', key: 'shopify', status: 'active' })),
            },
        });
        await expect(command.execute({
            tenantId: tenantA,
            channelId,
            marketplaceKey: 'shopify',
            externalOrderId: '1001',
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            idempotencyKey: 'k4',
        })).rejects.toBeInstanceOf(MarketplaceOrderLifecyclePermanentError);
    });
});
