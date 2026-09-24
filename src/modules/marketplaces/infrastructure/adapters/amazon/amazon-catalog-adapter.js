import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import { readAmazonMarketplaceId, resolveAmazonListingSku } from './amazon-config.js';
import { AmazonExternalEntityType } from './amazon-external-entity-types.js';
import { AmazonSpApiClient } from './amazon-sp-api-client.js';

export const AMAZON_MARKETPLACE_KEY = 'amazon';

export class AmazonCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    spApi;

    /**
     * @param {{ spApi?: AmazonSpApiClient, deploymentLwaTokenUrl?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(AMAZON_MARKETPLACE_KEY);
        this.spApi = deps.spApi ?? new AmazonSpApiClient({
            deploymentLwaTokenUrl: deps.deploymentLwaTokenUrl,
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
            await this.spApi.getMarketplaceParticipations(runtime);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncInventory(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            this.assertCapability(this.getCapabilities(), 'supportsInventorySync', 'inventory sync');
            const sku = resolveAmazonListingSku(input.externalCatalogIdentifier, '');
            await this.spApi.patchListingItem(runtime, sku, [{
                op: 'replace',
                path: '/attributes/fulfillment_availability',
                value: [{
                    fulfillment_channel_code: 'DEFAULT',
                    quantity: input.availableQuantity,
                }],
            }]);
            return listingMappingHint('product', input.productId, sku);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncPrice(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            this.assertCapability(this.getCapabilities(), 'supportsPriceSync', 'price sync');
            const sku = resolveAmazonListingSku(input.externalCatalogIdentifier, '');
            const amount = input.amountMinor / 100;
            const marketplaceId = readAmazonMarketplaceId(runtime.configuration ?? {});
            await this.spApi.patchListingItem(runtime, sku, [{
                op: 'replace',
                path: '/attributes/purchasable_offer',
                value: [{
                    marketplace_id: marketplaceId,
                    currency: input.currency,
                    audience: 'ALL',
                    our_price: [{ schedule: [{ value_with_tax: amount }] }],
                }],
            }]);
            return listingMappingHint('product', input.productId, sku);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceProductSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncProduct(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncProduct');
            this.assertCapability(this.getCapabilities(), 'supportsProductSync', 'product sync');
            const sku = resolveAmazonListingSku(input.externalCatalogIdentifier, input.merchantSku);
            if (input.operation === 'deactivate' || !shouldPublishListing(input)) {
                await this.setListingAvailability(runtime, sku, 0);
                return listingMappingHint('product', input.productId, sku);
            }
            return listingMappingHint('product', input.productId, sku);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncOffer(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncOffer');
            this.assertCapability(this.getCapabilities(), 'supportsOfferSync', 'offer sync');
            const sku = resolveAmazonListingSku(input.externalCatalogIdentifier, input.merchantSku);
            if (input.operation === 'deactivate' || !shouldPublishListing(input)) {
                await this.setListingAvailability(runtime, sku, 0);
                return [
                    listingMappingHint('offer', input.offerId, sku)[0],
                    listingMappingHint('product', input.productId, sku)[0],
                ];
            }
            if (input.operation === 'activate' || input.offerStatus === 'ACTIVE') {
                return [
                    listingMappingHint('offer', input.offerId, sku)[0],
                    listingMappingHint('product', input.productId, sku)[0],
                ];
            }
            return listingMappingHint('offer', input.offerId, sku);
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {string} sku
     * @param {number} quantity
     */
    async setListingAvailability(runtime, sku, quantity) {
        await this.spApi.patchListingItem(runtime, sku, [{
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [{
                fulfillment_channel_code: 'DEFAULT',
                quantity,
            }],
        }]);
    }
}

/**
 * @param {'product'|'offer'} nexoraEntityType
 * @param {string} nexoraEntityId
 * @param {string} sku
 */
function listingMappingHint(nexoraEntityType, nexoraEntityId, sku) {
    return [{
        nexoraEntityType,
        nexoraEntityId,
        externalEntityType: AmazonExternalEntityType.LISTING,
        externalEntityId: sku,
    }];
}

/**
 * @param {{ operation: string, offerStatus: string, productStatus?: string }} input
 */
function shouldPublishListing(input) {
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
