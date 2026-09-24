import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { NamshiCatalogAdapter } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-catalog-adapter.js';
import { NamshiApiClient } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-api-client.js';
import { NamshiAuthSessionProvider } from '../../../src/modules/marketplaces/infrastructure/adapters/namshi/namshi-auth-session.js';
import { MarketplaceHttpClient } from '../../../src/modules/marketplaces/infrastructure/http/marketplace-http-client.js';
import {
    MarketplaceCatalogAdapterPermanentError,
    MarketplaceCatalogAdapterRetryError,
} from '../../../src/modules/channel-catalog-sync/public/catalog-sync-adapter-errors.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const runtime = {
    marketplaceKey: 'namshi',
    connectionRequired: true,
    credentials: {
        keyId: 'namshi-key-id',
        privateKey: privateKeyPem,
        projectCode: 'PRJ-NAM',
    },
    configuration: {
        countryCode: 'ae',
        warehouseCode: 'WH-NAM-01',
        userAgent: 'Nexora-Test/1.0',
    },
};

function okBatch() {
    return { items: [{ status: { status_id: 0, status_code: 'OK', message: '' } }] };
}

describe('NamshiCatalogAdapter', () => {
    it('declares verified capabilities without product sync', () => {
        const adapter = new NamshiCatalogAdapter();
        const caps = adapter.getCapabilities();
        expect(caps.supportsConnectionTest).toBe(true);
        expect(caps.supportsInventorySync).toBe(true);
        expect(caps.supportsPriceSync).toBe(true);
        expect(caps.supportsProductSync).toBe(false);
    });

    it('syncPrice uses local pricing upsert endpoint', async () => {
        const upsertLocalPricing = vi.fn(async () => ({ json: okBatch() }));
        const adapter = new NamshiCatalogAdapter({
            api: {
                whoami: vi.fn(),
                updateStock: vi.fn(),
                upsertLocalPricing,
                getProductOffers: vi.fn(),
            },
        });
        await adapter.syncPrice({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
            productId: '00000000-0000-4000-8000-000000000003',
            externalCatalogIdentifier: 'NAM-SKU-1',
            currency: 'AED',
            amountMinor: 9900,
            validFrom: '2026-01-01T00:00:00.000Z',
            validTo: null,
            priceId: '00000000-0000-4000-8000-000000000005',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(upsertLocalPricing).toHaveBeenCalledWith(runtime, 'NAM-SKU-1', 99);
    });

    it('syncOffer deactivate sets stock qty to zero (not is_active)', async () => {
        const updateStock = vi.fn(async () => ({ json: okBatch() }));
        const adapter = new NamshiCatalogAdapter({
            api: {
                whoami: vi.fn(),
                updateStock,
                upsertLocalPricing: vi.fn(),
                getProductOffers: vi.fn(),
            },
        });
        await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'NAM-SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: 'NAM-SKU-1',
            offerStatus: 'INACTIVE',
            listingStatus: 'INACTIVE',
            operation: 'deactivate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(updateStock).toHaveBeenCalledWith(runtime, 'NAM-SKU-1', 0);
    });

    it('syncProduct returns permanent unsupported', async () => {
        const adapter = new NamshiCatalogAdapter();
        await expect(adapter.syncProduct({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
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

    it('syncOffer activate refreshes mappings without is_active pricing call', async () => {
        const updateStock = vi.fn();
        const upsertLocalPricing = vi.fn();
        const getProductOffers = vi.fn(async () => ({
            json: {
                partner_sku: 'NAM-SKU-1',
                sku: 'Z999',
                offers: [{ offer_code: 'AE-NAMSHI-NAM-SKU-1', country_code: 'ae' }],
            },
        }));
        const adapter = new NamshiCatalogAdapter({
            api: {
                whoami: vi.fn(),
                updateStock,
                upsertLocalPricing,
                getProductOffers,
            },
        });
        await adapter.syncOffer({
            tenantId: '00000000-0000-4000-8000-000000000001',
            channelId: '00000000-0000-4000-8000-000000000002',
            marketplaceKey: 'namshi',
            offerId: '00000000-0000-4000-8000-000000000010',
            productId: '00000000-0000-4000-8000-000000000003',
            merchantSku: 'NAM-SKU-1',
            productExternalReference: null,
            externalCatalogIdentifier: 'NAM-SKU-1',
            offerStatus: 'ACTIVE',
            listingStatus: 'ACTIVE',
            operation: 'activate',
            sourceEventId: 'evt',
            correlationId: null,
        }, runtime);
        expect(updateStock).not.toHaveBeenCalled();
        expect(upsertLocalPricing).not.toHaveBeenCalled();
        expect(getProductOffers).toHaveBeenCalledOnce();
    });
});

describe('NamshiCatalogAdapter HTTP errors', () => {
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
        const auth = new NamshiAuthSessionProvider({ http });
        const api = new NamshiApiClient({ http, auth });
        const adapter = new NamshiCatalogAdapter({ api });
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
        const auth = new NamshiAuthSessionProvider({ http });
        const api = new NamshiApiClient({ http, auth });
        const adapter = new NamshiCatalogAdapter({ api });
        await expect(adapter.testConnection(runtime)).rejects.toBeInstanceOf(MarketplaceCatalogAdapterRetryError);
    });
});
