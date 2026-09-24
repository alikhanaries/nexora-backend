import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import { MarketplaceConfigurationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';

export const AMAZON_MARKETPLACE_KEY = 'amazon';

const REGION_HOST = {
    na: 'https://sellingpartnerapi-na.amazon.com',
    eu: 'https://sellingpartnerapi-eu.amazon.com',
    fe: 'https://sellingpartnerapi-fe.amazon.com',
};

export class AmazonCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    http;

    constructor(deps = {}) {
        super(AMAZON_MARKETPLACE_KEY);
        this.http = deps.http ?? new MarketplaceHttpClient();
    }

    getCapabilities() {
        return {
            ...createEmptyMarketplaceCapabilities(),
            supportsInventorySync: true,
            supportsPriceSync: true,
            supportsConnectionTest: true,
        };
    }

    async testConnection(runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'testConnection');
            const token = await this.getAccessToken(runtime);
            const host = resolveHost(runtime.configuration);
            await this.http.request({
                url: `${host}/sellers/v1/marketplaceParticipations`,
                headers: { 'x-amz-access-token': token },
            });
        });
    }

    async syncInventory(input, runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            await this.patchListing(runtime, input.externalCatalogIdentifier, [{
                op: 'replace',
                path: '/attributes/fulfillment_availability',
                value: [{
                    fulfillment_channel_code: 'DEFAULT',
                    quantity: input.availableQuantity,
                }],
            }]);
        });
    }

    async syncPrice(input, runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            const amount = input.amountMinor / 100;
            const marketplaceId = readMarketplaceId(runtime.configuration);
            await this.patchListing(runtime, input.externalCatalogIdentifier, [{
                op: 'replace',
                path: '/attributes/purchasable_offer',
                value: [{
                    marketplace_id: marketplaceId,
                    currency: input.currency,
                    audience: 'ALL',
                    our_price: [{ schedule: [{ value_with_tax: amount }] }],
                }],
            }]);
        });
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} sku
     * @param {object[]} patches
     */
    async patchListing(runtime, sku, patches) {
        const token = await this.getAccessToken(runtime);
        const host = resolveHost(runtime.configuration);
        const sellerId = readSellerId(runtime.credentials);
        const marketplaceId = readMarketplaceId(runtime.configuration);
        const productType = typeof runtime.configuration.productType === 'string'
            ? runtime.configuration.productType
            : 'PRODUCT';
        const url = `${host}/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;
        await this.http.request({
            url,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-amz-access-token': token,
            },
            body: JSON.stringify({ productType, patches }),
        });
    }

    /** @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime */
    async getAccessToken(runtime) {
        const { clientId, clientSecret, refreshToken } = readAmazonCredentials(runtime.credentials);
        const response = await this.http.request({
            url: 'https://api.amazon.com/auth/o2/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });
        const accessToken = response.json?.access_token;
        if (typeof accessToken !== 'string' || accessToken.length === 0) {
            throw new MarketplaceConfigurationError('Amazon LWA token response did not include access_token');
        }
        return accessToken;
    }
}

/**
 * @param {Record<string, unknown>} credentials
 */
function readAmazonCredentials(credentials) {
    const clientId = stringField(credentials, 'clientId');
    const clientSecret = stringField(credentials, 'clientSecret');
    const refreshToken = stringField(credentials, 'refreshToken');
    if (clientId === null || clientSecret === null || refreshToken === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires clientId, clientSecret, and refreshToken');
    }
    return { clientId, clientSecret, refreshToken };
}

function readSellerId(credentials) {
    const sellerId = stringField(credentials, 'sellerId');
    if (sellerId === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires sellerId');
    }
    return sellerId;
}

/**
 * @param {Record<string, unknown>} configuration
 */
function readMarketplaceId(configuration) {
    const marketplaceId = stringField(configuration, 'marketplaceId');
    if (marketplaceId === null) {
        throw new MarketplaceConfigurationError('Amazon connection requires configuration.marketplaceId');
    }
    return marketplaceId;
}

/**
 * @param {Record<string, unknown>} configuration
 */
function resolveHost(configuration) {
    const region = typeof configuration.region === 'string' ? configuration.region : 'na';
    const host = REGION_HOST[region];
    if (host === undefined) {
        throw new MarketplaceConfigurationError(`Unsupported Amazon region: ${region}`);
    }
    return host;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 */
function stringField(record, key) {
    const value = record[key];
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
