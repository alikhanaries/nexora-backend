import { MarketplaceValidationError } from '../../../models/marketplace-errors.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';
import {
    readNoonCountryCode,
    readNoonWarehouseCode,
    resolveNoonApiBaseUrl,
    resolveNoonUserAgent,
} from './noon-config.js';
import { assertNoonBatchItemsSucceeded } from './noon-batch-response.js';
import { NoonAuthSessionProvider } from './noon-auth-session.js';
import { assertNoonCatalogWritesEnabled } from './noon-catalog-write-guard.js';
import { assertNoonTestLaneHttpAllowed } from './noon-test-lane-http-guard.js';

export class NoonApiClient {
    http;
    auth;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;
    /** @type {boolean} */
    catalogWritesEnabled;
    /** @type {boolean} */
    testLaneBlockExternalHttp;
    /** @type {import('../../../../../shared/logging/logger.port.js').Logger | undefined} */
    logger;

    /**
     * @param {{ http?: MarketplaceHttpClient, auth?: NoonAuthSessionProvider, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null, catalogWritesEnabled?: boolean, testLaneBlockExternalHttp?: boolean, logger?: import('../../../../../shared/logging/logger.port.js').Logger }} [deps]
     */
    constructor(deps = {}) {
        this.http = deps.http ?? new MarketplaceHttpClient();
        this.testLaneBlockExternalHttp = deps.testLaneBlockExternalHttp ?? false;
        this.auth = deps.auth ?? new NoonAuthSessionProvider({
            http: this.http,
            deploymentApiBaseUrl: deps.deploymentApiBaseUrl,
            deploymentUserAgent: deps.deploymentUserAgent,
            testLaneBlockExternalHttp: this.testLaneBlockExternalHttp,
            logger: deps.logger,
        });
        this.deploymentApiBaseUrl = deps.deploymentApiBaseUrl;
        this.deploymentUserAgent = deps.deploymentUserAgent;
        this.catalogWritesEnabled = deps.catalogWritesEnabled ?? false;
        this.logger = deps.logger;
    }

    /**
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async whoami(runtime) {
        return this.authenticatedRequest(runtime, {
            path: '/identity/v1/whoami',
            method: 'GET',
        });
    }

    /**
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
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
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
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
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
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
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     */
    async getProductOffers(runtime, partnerSku) {
        return this.authenticatedRequest(runtime, {
            path: `/offer/v1/product/${encodeURIComponent(partnerSku)}`,
            method: 'GET',
        });
    }

    /**
     * BatchGetPricing (read-only). Per-item failures (e.g. NOT_FOUND) are returned in `json.items`;
     * callers must inspect `items[].status` before using price fields.
     *
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {{ partner_sku: string, country_code: string }[]} items
     */
    async batchGetPricing(runtime, items) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new MarketplaceValidationError('batchGetPricing requires at least one item');
        }
        const normalizedItems = items.map((item) => {
            const partnerSku = String(item.partner_sku ?? '').trim();
            const countryCode = String(item.country_code ?? '').trim().toLowerCase();
            if (partnerSku.length === 0 || countryCode.length === 0) {
                throw new MarketplaceValidationError('Each pricing item requires partner_sku and country_code');
            }
            return { partner_sku: partnerSku, country_code: countryCode };
        });
        return this.authenticatedRequest(runtime, {
            path: '/pricing/v1/pricing/get',
            method: 'POST',
            body: { items: normalizedItems },
        });
    }

    /**
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} partnerSku
     * @param {string} countryCode lowercase ae|sa|eg
     */
    async getPricing(runtime, partnerSku, countryCode) {
        const response = await this.batchGetPricing(runtime, [{
            partner_sku: partnerSku,
            country_code: countryCode,
        }]);
        return response;
    }

    /**
     * FBPI GetFbpiOrder — full order details for lifecycle sync (Phase 35).
     *
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} fbpiOrderNr
     */
    async getFbpiOrder(runtime, fbpiOrderNr) {
        const trimmed = fbpiOrderNr.trim();
        if (trimmed.length === 0) {
            throw new MarketplaceValidationError('fbpiOrderNr is required');
        }
        return this.authenticatedRequest(runtime, {
            path: `/fbpi/v1/fbpi-order/${encodeURIComponent(trimmed)}/get`,
            method: 'GET',
        });
    }

    /**
     * FBPI CreateShipment — register seller shipment with AWB (Phase 41 outbound fulfill).
     *
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
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
     * @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {{ path: string, method?: string, body?: unknown }} request
     */
    async authenticatedRequest(runtime, request) {
        assertNoonCatalogWritesEnabled(
            this.catalogWritesEnabled,
            request.method,
            request.path,
            this.logger,
        );
        const baseUrl = resolveNoonApiBaseUrl(runtime.configuration ?? {}, this.deploymentApiBaseUrl);
        assertNoonTestLaneHttpAllowed(
            this.testLaneBlockExternalHttp,
            baseUrl,
            request.method,
            request.path,
            this.logger,
        );
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
