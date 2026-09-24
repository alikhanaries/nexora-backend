import { describe, expect, it } from 'vitest';
import { MarketplaceOrderAdapterRegistry } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-adapter-registry.js';
import { MarketplaceOrderIngestionPermanentError } from '../../../src/modules/marketplace-order-ingestion/public/marketplace-order-ingestion-errors.js';
import { registerMarketplaceCatalogAdapters } from '../../../src/modules/marketplaces/infrastructure/adapters/register-marketplace-catalog-adapters.js';
import { MarketplaceCatalogAdapterRegistry } from '../../../src/modules/channel-catalog-sync/public/marketplace-catalog-adapter-registry.js';

/**
 * @param {import('../../../src/modules/marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderAdapter} adapter
 */
export function runMarketplaceOrderAdapterContractTests(adapter) {
    describe(`order adapter contract (${adapter.marketplaceKey})`, () => {
        it('declares order capabilities when getOrderCapabilities exists', () => {
            if (typeof adapter.getOrderCapabilities !== 'function') {
                return;
            }
            const caps = adapter.getOrderCapabilities();
            expect(typeof caps.supportsOrdersInbound).toBe('boolean');
            expect(typeof caps.supportsOrderWebhookIngestion).toBe('boolean');
            expect(typeof caps.supportsOrderPolling).toBe('boolean');
        });
        it('does not register fetchOrder unless inbound orders are supported', () => {
            const caps = adapter.getOrderCapabilities?.();
            if (caps?.supportsOrdersInbound === true) {
                expect(typeof adapter.fetchOrder).toBe('function');
                return;
            }
            expect(adapter.fetchOrder).toBeUndefined();
        });
    });
}

describe('marketplace order adapter registry', () => {
    it('catalog adapters remain separate from order registry', () => {
        const catalogRegistry = new MarketplaceCatalogAdapterRegistry();
        registerMarketplaceCatalogAdapters(catalogRegistry, {});
        const orderRegistry = new MarketplaceOrderAdapterRegistry();
        expect(orderRegistry.listAdapters()).toHaveLength(0);
        expect(catalogRegistry.resolve('shopify')).not.toBeNull();
    });
});

describe('ingest fetch guard', () => {
    it('fetch without adapter is permanent', async () => {
        const { IngestNormalizedMarketplaceOrder } = await import('../../../src/modules/marketplace-order-ingestion/application/ingest-normalized-marketplace-order.js');
        const useCase = new IngestNormalizedMarketplaceOrder({
            ingestionService: { ingest: async () => ({}) },
            orderAdapterRegistry: new MarketplaceOrderAdapterRegistry(),
            database: { execute: async (fn) => fn({}) },
        });
        await expect(useCase.execute({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'shopify',
            externalOrderId: '123',
        })).rejects.toBeInstanceOf(MarketplaceOrderIngestionPermanentError);
    });
});
