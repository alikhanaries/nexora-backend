import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readNoonCountryCode,
    readNoonWarehouseCode,
    resolveNoonApiBaseUrl,
    resolveNoonUserAgent,
} from './noon-config.js';
import { assertNoonBatchItemsSucceeded } from './noon-batch-response.js';
import { NoonAuthSessionProvider } from './noon-auth-session.js';

export class NoonApiClient {
    http;
    auth;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;

    /**
     * @param {{ http?: MarketplaceHttpClient, auth?: NoonAuthSessionProvider, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.auth = deps.auth ?? new NoonAuthSessionProvider({
            http: this.http,
            deploymentApiBaseUrl: deps.deploymentApiBaseUrl,
            deploymentUserAgent: deps.deploymentUserAgent,
        });
        this.deploymentApiBaseUrl = deps.deploymentApiBaseUrl;
        this.deploymentUserAgent = deps.deploymentUserAgent;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async whoami(runtime) {
        return this.authenticatedRequest(runtime, {
            path: '/identity/v1/whoami',
            method: 'GET',
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     * @param {number} quantity
     */
    async updateStock(runtime, partnerSku, quantity) {
        const warehouseCode = readNoonWarehouseCode(runtime.configuration ?? {});
        const response = await this.authenticatedRequest(runtime, {
            path: '/stock/v1/stock-update',
            method: 'POST',
            body: {
                items: [{
                    warehouse_code: warehouseCode,
                    partner_sku: partnerSku,
                    qty: quantity,
                }],
            },
        });
        assertNoonBatchItemsSucceeded(response.json, 'stock update');
        return response;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     * @param {number} price
     * @param {{ isActive?: boolean }} [options]
     */
    async upsertPricing(runtime, partnerSku, price, options = {}) {
        const countryCode = readNoonCountryCode(runtime.configuration ?? {});
        /** @type {Record<string, unknown>} */
        const item = {
            partner_sku: partnerSku,
            country_code: countryCode,
            price,
        };
        if (options.isActive !== undefined) {
            item.is_active = options.isActive;
        }
        const response = await this.authenticatedRequest(runtime, {
            path: '/pricing/v1/pricing/upsert',
            method: 'POST',
            body: { items: [item] },
        });
        assertNoonBatchItemsSucceeded(response.json, 'pricing upsert');
        return response;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     * @param {boolean} isActive
     */
    async setOfferActive(runtime, partnerSku, isActive) {
        const countryCode = readNoonCountryCode(runtime.configuration ?? {});
        const response = await this.authenticatedRequest(runtime, {
            path: '/pricing/v1/pricing/upsert',
            method: 'POST',
            body: {
                items: [{
                    partner_sku: partnerSku,
                    country_code: countryCode,
                    is_active: isActive,
                }],
            },
        });
        assertNoonBatchItemsSucceeded(response.json, 'offer activation');
        return response;
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     */
    async getProductOffers(runtime, partnerSku) {
        return this.authenticatedRequest(runtime, {
            path: `/offer/v1/product/${encodeURIComponent(partnerSku)}`,
            method: 'GET',
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {{ path: string, method?: string, body?: unknown }} request
     */
    async authenticatedRequest(runtime, request) {
        const baseUrl = resolveNoonApiBaseUrl(runtime.configuration ?? {}, this.deploymentApiBaseUrl);
        const userAgent = resolveNoonUserAgent(runtime.configuration ?? {}, this.deploymentUserAgent);
        const cookieHeader = await this.auth.getCookieHeader(runtime);
        return this.http.request({
            url: `${baseUrl}${request.path}`,
            method: request.method ?? 'GET',
            headers: {
                'User-Agent': userAgent,
                Cookie: cookieHeader,
                ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        });
    }
}
