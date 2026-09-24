import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import { MarketplaceConfigurationError, MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import { MarketplaceHttpClient } from '../../http/marketplace-http-client.js';

export const SHOPIFY_MARKETPLACE_KEY = 'shopify';

export class ShopifyCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    http;

    /** @param {{ http?: MarketplaceHttpClient }} [deps] */
    constructor(deps = {}) {
        super(SHOPIFY_MARKETPLACE_KEY);
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

    /** @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime */
    async testConnection(runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'testConnection');
            await this.graphql(runtime, `query { shop { name } }`, {});
        });
    }

    /** @param {import('../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} input @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncInventory(input, runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            const caps = this.getCapabilities();
            this.assertCapability(caps, 'supportsInventorySync', 'inventory sync');
            const locationId = readShopifyLocationId(runtime.configuration);
            const inventoryItemId = await this.resolveInventoryItemId(runtime, input.externalCatalogIdentifier);
            await this.graphql(runtime, `
                mutation InventorySet($input: InventorySetQuantitiesInput!) {
                  inventorySetQuantities(input: $input) {
                    userErrors { field message }
                  }
                }`, {
                input: {
                    name: 'available',
                    reason: 'correction',
                    ignoreCompareQuantity: true,
                    quantities: [{
                        inventoryItemId,
                        locationId,
                        quantity: input.availableQuantity,
                    }],
                },
            });
        });
    }

    /** @param {import('../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} input @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncPrice(input, runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            this.assertCapability(this.getCapabilities(), 'supportsPriceSync', 'price sync');
            const variantGid = toVariantGid(input.externalCatalogIdentifier);
            const amount = (input.amountMinor / 100).toFixed(2);
            await this.graphql(runtime, `
                mutation VariantPrice($input: ProductVariantInput!) {
                  productVariantUpdate(input: $input) {
                    userErrors { field message }
                  }
                }`, {
                input: {
                    id: variantGid,
                    price: amount,
                },
            });
        });
    }

    /** @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime @param {string} externalCatalogIdentifier */
    async resolveInventoryItemId(runtime, externalCatalogIdentifier) {
        const variantGid = toVariantGid(externalCatalogIdentifier);
        const data = await this.graphql(runtime, `
            query VariantInventory($id: ID!) {
              productVariant(id: $id) { inventoryItem { id } }
            }`, { id: variantGid });
        const id = data?.productVariant?.inventoryItem?.id;
        if (typeof id !== 'string' || id.length === 0) {
            throw new MarketplaceValidationError('Shopify variant inventory item was not found');
        }
        return id;
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     */
    async graphql(runtime, query, variables) {
        const { shopDomain, accessToken } = readShopifyCredentials(runtime.credentials);
        const apiVersion = typeof runtime.configuration.apiVersion === 'string'
            ? runtime.configuration.apiVersion
            : '2024-10';
        const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
        const response = await this.http.request({
            url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });
        const json = response.json;
        if (json === undefined || typeof json !== 'object') {
            throw new MarketplaceValidationError('Shopify returned a non-JSON GraphQL response');
        }
        const errors = json.errors;
        if (Array.isArray(errors) && errors.length > 0) {
            throw new MarketplaceValidationError(errors[0]?.message ?? 'Shopify GraphQL error');
        }
        const userErrors = collectUserErrors(json.data);
        if (userErrors.length > 0) {
            throw new MarketplaceValidationError(userErrors[0]?.message ?? 'Shopify user error');
        }
        return json.data;
    }
}

/**
 * @param {Record<string, unknown>} credentials
 */
function readShopifyCredentials(credentials) {
    const shopDomain = typeof credentials.shopDomain === 'string' ? credentials.shopDomain.trim() : '';
    const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
    if (shopDomain.length === 0 || accessToken.length === 0) {
        throw new MarketplaceConfigurationError('Shopify connection requires shopDomain and accessToken');
    }
    return { shopDomain, accessToken };
}

/**
 * @param {Record<string, unknown>} configuration
 */
function readShopifyLocationId(configuration) {
    const locationId = typeof configuration.shopifyLocationId === 'string'
        ? configuration.shopifyLocationId.trim()
        : '';
    if (locationId.length === 0) {
        throw new MarketplaceConfigurationError('Shopify inventory sync requires configuration.shopifyLocationId');
    }
    return locationId.startsWith('gid://') ? locationId : `gid://shopify/Location/${locationId}`;
}

/**
 * @param {string} externalCatalogIdentifier
 */
function toVariantGid(externalCatalogIdentifier) {
    if (externalCatalogIdentifier.startsWith('gid://')) {
        return externalCatalogIdentifier;
    }
    return `gid://shopify/ProductVariant/${externalCatalogIdentifier}`;
}

/**
 * @param {unknown} data
 */
function collectUserErrors(data) {
    if (data === null || typeof data !== 'object') {
        return [];
    }
    /** @type {Array<{ message?: string }>} */
    const collected = [];
    for (const value of Object.values(data)) {
        if (value !== null && typeof value === 'object' && Array.isArray(value.userErrors)) {
            collected.push(...value.userErrors);
        }
    }
    return collected;
}
