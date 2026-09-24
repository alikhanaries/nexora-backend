import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import {
    MarketplaceConfigurationError,
    MarketplaceNotFoundError,
    MarketplaceValidationError,
} from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import {
    readShopifyLocationId,
    toShopifyVariantGid,
} from './shopify-config.js';
import { ShopifyExternalEntityType } from './shopify-external-entity-types.js';
import { ShopifyGraphqlClient } from './shopify-graphql-client.js';

export const SHOPIFY_MARKETPLACE_KEY = 'shopify';

export class ShopifyCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    graphql;

    /**
     * @param {{ graphql?: ShopifyGraphqlClient, deploymentDefaultApiVersion?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(SHOPIFY_MARKETPLACE_KEY);
        this.graphql = deps.graphql ?? new ShopifyGraphqlClient({
            deploymentDefaultApiVersion: deps.deploymentDefaultApiVersion,
        });
    }

    getCapabilities() {
        return {
            ...createEmptyMarketplaceCapabilities(),
            supportsProductSync: true,
            supportsOfferSync: true,
            supportsInventorySync: true,
            supportsPriceSync: true,
            supportsActivation: true,
            supportsDeactivation: true,
            supportsConnectionTest: true,
        };
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime */
    async testConnection(runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'testConnection');
            await this.graphql.execute(runtime, `query { shop { name } }`, {});
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncInventory(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            this.assertCapability(this.getCapabilities(), 'supportsInventorySync', 'inventory sync');
            const locationId = readShopifyLocationId(runtime.configuration);
            const inventoryItemId = await this.resolveInventoryItemId(runtime, input.externalCatalogIdentifier);
            await this.graphql.execute(runtime, `
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
            return [{
                nexoraEntityType: 'product',
                nexoraEntityId: input.productId,
                externalEntityType: ShopifyExternalEntityType.INVENTORY_ITEM,
                externalEntityId: inventoryItemId,
            }];
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncPrice(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            this.assertCapability(this.getCapabilities(), 'supportsPriceSync', 'price sync');
            const variantGid = toShopifyVariantGid(input.externalCatalogIdentifier);
            const amount = (input.amountMinor / 100).toFixed(2);
            await this.graphql.execute(runtime, `
                mutation VariantPrice($input: ProductVariantInput!) {
                  productVariantUpdate(input: $input) {
                    productVariant { id }
                    userErrors { field message }
                  }
                }`, {
                input: {
                    id: variantGid,
                    price: amount,
                },
            });
            return undefined;
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceProductSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncProduct(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncProduct');
            this.assertCapability(this.getCapabilities(), 'supportsProductSync', 'product sync');
            if (input.operation === 'deactivate' || !shouldPublishCatalogListing(input)) {
                await this.setVariantListingPublished(runtime, input.externalCatalogIdentifier, false);
                return undefined;
            }
            if (input.externalCatalogIdentifier.trim().length === 0) {
                throw new MarketplaceConfigurationError('Shopify product sync requires offer.externalReference as the Shopify variant id');
            }
            const variantContext = await this.loadVariantContext(runtime, input.externalCatalogIdentifier);
            await this.graphql.execute(runtime, `
                mutation VariantSku($input: ProductVariantInput!) {
                  productVariantUpdate(input: $input) {
                    productVariant { id sku }
                    userErrors { field message }
                  }
                }`, {
                input: {
                    id: variantContext.variantGid,
                    sku: input.merchantSku,
                },
            });
            await this.setProductStatus(runtime, variantContext.productGid, 'ACTIVE');
            return [{
                nexoraEntityType: 'product',
                nexoraEntityId: input.productId,
                externalEntityType: ShopifyExternalEntityType.PRODUCT,
                externalEntityId: variantContext.productGid,
            }];
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncOffer(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncOffer');
            this.assertCapability(this.getCapabilities(), 'supportsOfferSync', 'offer sync');
            if (input.operation === 'deactivate' || !shouldPublishCatalogListing(input)) {
                if (input.externalCatalogIdentifier.trim().length === 0) {
                    return undefined;
                }
                await this.setVariantListingPublished(runtime, input.externalCatalogIdentifier, false);
                return undefined;
            }
            if (input.externalCatalogIdentifier.trim().length === 0) {
                throw new MarketplaceConfigurationError('Shopify offer sync requires offer.externalReference as the Shopify variant id');
            }
            const variantContext = await this.loadVariantContext(runtime, input.externalCatalogIdentifier);
            await this.graphql.execute(runtime, `
                mutation OfferVariant($input: ProductVariantInput!) {
                  productVariantUpdate(input: $input) {
                    productVariant { id sku }
                    userErrors { field message }
                  }
                }`, {
                input: {
                    id: variantContext.variantGid,
                    sku: input.merchantSku,
                },
            });
            if (input.operation === 'activate' ||
                input.offerStatus === 'ACTIVE') {
                await this.setProductStatus(runtime, variantContext.productGid, 'ACTIVE');
            }
            return [{
                nexoraEntityType: 'offer',
                nexoraEntityId: input.offerId,
                externalEntityType: ShopifyExternalEntityType.PRODUCT_VARIANT,
                externalEntityId: variantContext.variantGid,
            }, {
                nexoraEntityType: 'product',
                nexoraEntityId: input.productId,
                externalEntityType: ShopifyExternalEntityType.PRODUCT,
                externalEntityId: variantContext.productGid,
            }];
        });
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} externalCatalogIdentifier
     */
    async resolveInventoryItemId(runtime, externalCatalogIdentifier) {
        const variantGid = toShopifyVariantGid(externalCatalogIdentifier);
        const data = await this.graphql.execute(runtime, `
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
     * Deactivate sets the parent product to DRAFT (not deleted).
     *
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} externalCatalogIdentifier
     * @param {boolean} published
     */
    async setVariantListingPublished(runtime, externalCatalogIdentifier, published) {
        if (externalCatalogIdentifier.trim().length === 0) {
            return;
        }
        const variantContext = await this.loadVariantContext(runtime, externalCatalogIdentifier);
        await this.setProductStatus(runtime, variantContext.productGid, published ? 'ACTIVE' : 'DRAFT');
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} externalCatalogIdentifier
     */
    async loadVariantContext(runtime, externalCatalogIdentifier) {
        const variantGid = toShopifyVariantGid(externalCatalogIdentifier);
        const data = await this.graphql.execute(runtime, `
            query VariantContext($id: ID!) {
              productVariant(id: $id) {
                id
                product { id status }
              }
            }`, { id: variantGid });
        const variant = data?.productVariant;
        const productGid = variant?.product?.id;
        if (typeof variant?.id !== 'string' || typeof productGid !== 'string') {
            throw new MarketplaceNotFoundError('Shopify product variant was not found');
        }
        return { variantGid: variant.id, productGid };
    }

    /**
     * @param {import('../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} productGid
     * @param {'ACTIVE'|'DRAFT'} status
     */
    async setProductStatus(runtime, productGid, status) {
        await this.graphql.execute(runtime, `
            mutation ProductStatus($input: ProductInput!) {
              productUpdate(input: $input) {
                product { id status }
                userErrors { field message }
              }
            }`, {
            input: {
                id: productGid,
                status,
            },
        });
    }
}

/**
 * @param {{ operation: string, offerStatus: string, productStatus?: string }} input
 */
function shouldPublishCatalogListing(input) {
    if (input.operation === 'deactivate') {
        return false;
    }
    if (input.offerStatus === 'INACTIVE' || input.offerStatus === 'SUSPENDED') {
        return false;
    }
    if (typeof input.productStatus === 'string' && input.productStatus !== 'ACTIVE') {
        return false;
    }
    if (input.operation === 'activate') {
        return true;
    }
    return input.offerStatus === 'ACTIVE';
}
