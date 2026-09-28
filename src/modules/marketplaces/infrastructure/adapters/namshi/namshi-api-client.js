import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readNamshiCountryCode,
    readNamshiWarehouseCode,
    resolveNamshiApiBaseUrl,
    resolveNamshiUserAgent,
} from './namshi-config.js';
import { assertNamshiBatchItemsSucceeded } from './namshi-batch-response.js';
import { NamshiAuthSessionProvider } from './namshi-auth-session.js';

export class NamshiApiClient {
    http;
    auth;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;

    /**
     * @param {{ http?: MarketplaceHttpClient, auth?: NamshiAuthSessionProvider, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.auth = deps.auth ?? new NamshiAuthSessionProvider({
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
        const warehouseCode = readNamshiWarehouseCode(runtime.configuration ?? {});
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
        assertNamshiBatchItemsSucceeded(response.json, 'stock update');
        return response;
    }

    /**
     * Namshi local pricing upsert (verified: POST /pricing/v1/local/upsert).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     * @param {number} price
     */
    async upsertLocalPricing(runtime, partnerSku, price) {
        const countryCode = readNamshiCountryCode(runtime.configuration ?? {});
        const response = await this.authenticatedRequest(runtime, {
            path: '/pricing/v1/local/upsert',
            method: 'POST',
            body: {
                items: [{
                    partner_sku: partnerSku,
                    country_code: countryCode,
                    price,
                }],
            },
        });
        assertNamshiBatchItemsSucceeded(response.json, 'local pricing upsert');
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
     * FBPI order details (verified: GET /fbpi/v1/fbpi-order/{fbpi_order_nr}/get).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} fbpiOrderNr
     */
    async getFbpiOrder(runtime, fbpiOrderNr) {
        const trimmed = fbpiOrderNr.trim();
        if (trimmed.length === 0) {
            throw new MarketplaceValidationError('fbpi_order_nr is required');
        }
        return this.authenticatedRequest(runtime, {
            path: `/fbpi/v1/fbpi-order/${encodeURIComponent(trimmed)}/get`,
            method: 'GET',
        });
    }

    /**
     * FBPI CreateShipment — register seller shipment with AWB (Phase 42 outbound fulfill).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {object} body
     */
    async createFbpiShipment(runtime, body) {
        return this.authenticatedRequest(runtime, {
            path: '/fbpi/v1/shipment/create',
            method: 'POST',
            body,
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {{ path: string, method?: string, body?: unknown }} request
     */
    async authenticatedRequest(runtime, request) {
        const baseUrl = resolveNamshiApiBaseUrl(runtime.configuration ?? {}, this.deploymentApiBaseUrl);
        const userAgent = resolveNamshiUserAgent(runtime.configuration ?? {}, this.deploymentUserAgent);
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
