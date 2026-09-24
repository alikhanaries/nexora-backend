import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NoonCatalogAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-catalog-adapter.js';
import { NoonApiClient } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-api-client.js';
import { NoonAuthSessionProvider } from '../../../src/modules/marketplaces/infrastructure/adapters/noon/noon-auth-session.js';
import { MarketplaceHttpClient } from '../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const runtime = {
    marketplaceKey: 'noon',
    connectionRequired: true,
    credentials: {
        keyId: 'noon-key-id',
        privateKey: privateKeyPem,
        projectCode: 'PRJ001',
    },
    configuration: {
        countryCode: 'ae',
        warehouseCode: 'WH-DXB-01',
        userAgent: 'Nexora-Test/1.0',
    },
};

function okBatch() {
    return { items: [{ status: { status_id: 0, status_code: 'OK', message: '' } }] };
}

describe('NoonCatalogAdapter', () => {
    it('declares verified catalog capabilities without product sync', () => {
        const adapter = new NoonCatalogAdapter();
        const caps = adapter.getCapabilities();
        expect(caps.supportsConnectionTest).toBe(true);
        expect(caps.supportsInventorySync).toBe(true);
        expect(caps.supportsPriceSync).toBe(true);
        expect(caps.supportsOfferSync).toBe(true);
        expect(caps.supportsActivation).toBe(true);
        expect(caps.supportsDeactivation).toBe(true);
        expect(caps.supportsProductSync).toBe(false);
    });

    it('testConnection calls whoami', async () => {
        const whoami = vi.fn(async () => ({ status: 200, json: { email: 'seller@example.com' } }));
        const adapter = new NoonCatalogAdapter({
            api: { whoami, updateStock: vi.fn(), upsertPricing: vi.fn(), setOfferActive: vi.fn(), getProductOffers: vi.fn() },
        });
        await adapter.testConnection(runtime);
        expect(whoami).toHaveBeenCalledOnce();
    });

    it('syncInventory sends absolute quantity', async () => {
        const updateStock = vi.fn(async () => ({ json: okBatch() }));
        const adapter = new NoonCatalogAdapter({
            api: { whoami: vi.fn(), updateStock, upsertPricing: vi.fn(), setOfferActive: vi.fn(), getProductOffers: vi.fn() },
        });
        const hints = await adapter.syncInventory({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'noon',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: 'PARTNER-SKU-1',
            stockLocationId: '00000000-0000-4000-8000-000000000004',
            availableQuantity: 0,
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(updateStock).toHaveBeenCalledWith(runtime, 'PARTNER-SKU-1', 0);
        expect(hints?.[0]?.externalEntityId).toBe('PARTNER-SKU-1');
    });

    it('syncPrice converts minor units to decimal price', async () => {
        const upsertPricing = vi.fn(async () => ({ json: okBatch() }));
        const adapter = new NoonCatalogAdapter({
            api: { whoami: vi.fn(), updateStock: vi.fn(), upsertPricing, setOfferActive: vi.fn(), getProductOffers: vi.fn() },
        });
        await adapter.syncPrice({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'noon',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: 'PARTNER-SKU-1',
            currency: 'AED',
            amountMinor: 14999,
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: null,
            priceId: '00000000-0000-4000-8000-000000000005',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(upsertPricing).toHaveBeenCalledWith(runtime, 'PARTNER-SKU-1', 149.99);
    });

    it('syncProduct returns permanent unsupported', async () => {
        const adapter = new NoonCatalogAdapter();
        await expect(adapter.syncProduct({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'noon',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'SKU',
            productType: 'SIMPLE',
            productStatus: 'ACTIVE',
            productExternalReference: null,
            externalCatalogIdentifier: 'SKU',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'sync',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('syncOffer deactivate sets is_active false via pricing upsert', async () => {
        const setOfferActive = vi.fn(async () => ({ json: okBatch() }));
        const adapter = new NoonCatalogAdapter({
            api: { whoami: vi.fn(), updateStock: vi.fn(), upsertPricing: vi.fn(), setOfferActive, getProductOffers: vi.fn() },
        });
        await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'noon',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'PARTNER-SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: 'PARTNER-SKU-1',
            offerStatus: 'INACTIVE',
            listingStatus: 'INACTIVE',
            operation: 'deactivate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(setOfferActive).toHaveBeenCalledWith(runtime, 'PARTNER-SKU-1', false);
    });

    it('syncOffer activate relists and returns offer mapping hints', async () => {
        const setOfferActive = vi.fn(async () => ({ json: okBatch() }));
        const getProductOffers = vi.fn(async () => ({
            json: {
                partner_sku: 'PARTNER-SKU-1',
                sku: 'Z1234567890123',
                offers: [{
                    offer_code: 'AE-NOON-PARTNER-SKU-1',
                    country_code: 'ae',
                    is_active: true,
                }],
            },
        }));
        const adapter = new NoonCatalogAdapter({
            api: { whoami: vi.fn(), updateStock: vi.fn(), upsertPricing: vi.fn(), setOfferActive, getProductOffers },
        });
        const hints = await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'noon',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'PARTNER-SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: 'PARTNER-SKU-1',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'activate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(setOfferActive).toHaveBeenCalledWith(runtime, 'PARTNER-SKU-1', true);
        expect(hints?.some((h) => h.externalEntityType === 'noon_offer')).toBe(true);
        expect(hints?.some((h) => h.externalEntityType === 'noon_catalog_sku')).toBe(true);
    });
});

describe('NoonCatalogAdapter HTTP errors', () => {
    it('maps 401 on whoami to permanent adapter error', async () => {
        const fetchImpl = vi.fn(async (url) => {
            if (String(url).includes('/login')) {
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'set-cookie': 'session=abc; Path=/' },
                });
            }
            return new Response('unauthorized', { status: 401 });
        });
        const http = new MarketplaceHttpClient({ fetchImpl });
        const auth = new NoonAuthSessionProvider({ http });
        const api = new NoonApiClient({ http, auth });
        const adapter = new NoonCatalogAdapter({ api });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterPermanentError);
    });

    it('maps 500 to retry adapter error', async () => {
        const fetchImpl = vi.fn(async (url) => {
            if (String(url).includes('/login')) {
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'set-cookie': 'session=abc; Path=/' },
                });
            }
            return new Response('error', { status: 500 });
        });
        const http = new MarketplaceHttpClient({ fetchImpl });
        const auth = new NoonAuthSessionProvider({ http });
        const api = new NoonApiClient({ http, auth });
        const adapter = new NoonCatalogAdapter({ api });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });
});

describe('NoonAuthSessionProvider', () => {
    it('isolates sessions per connection credentials', async () => {
        let loginCount = 0;
        const fetchImpl = vi.fn(async () => {
            loginCount += 1;
            return new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'set-cookie': `session=s${loginCount}; Path=/` },
            });
        });
        const http = new MarketplaceHttpClient({ fetchImpl });
        const auth = new NoonAuthSessionProvider({ http });
        const runtimeB = {
            ...runtime,
            credentials: {
                ...runtime.credentials,
                keyId: 'other-key',
            },
        };
        await auth.getCookieHeader(runtime);
        await auth.getCookieHeader(runtime);
        await auth.getCookieHeader(runtimeB);
        expect(loginCount).toBe(2);
    });

    it('does not expose private key in authentication errors', async () => {
        const fetchImpl = vi.fn(async () => new Response('bad', { status: 401 }));
        const http = new MarketplaceHttpClient({ fetchImpl });
        const auth = new NoonAuthSessionProvider({ http });
        const err = await auth.login(runtime).catch((e) => e);
        expect(err.name).toBe('MarketplaceAuthenticationError');
        expect(String(err.message)).not.toContain('PRIVATE KEY');
        expect(String(err.message)).not.toContain(privateKeyPem);
    });
});
