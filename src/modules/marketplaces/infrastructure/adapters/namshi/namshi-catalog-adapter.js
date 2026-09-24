import { createEmptyMarketplaceCapabilities } from '../../../domain/marketplace-capabilities.js';
import { MarketplaceUnsupportedError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import { NamshiApiClient } from './namshi-api-client.js';
import { readNamshiCountryCode, resolveNamshiPartnerSku } from './namshi-config.js';
import { NamshiExternalEntityType } from './namshi-external-entity-types.js';

export const NAMSHI_MARKETPLACE_KEY = 'namshi';

/**
 * Namshi seller APIs on the noon Partners gateway (local pricing + stock update).
 * Catalog creation is out of band (Seller Lab / Content API).
 */
export class NamshiCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    api;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;

    /**
     * @param {{ api?: NamshiApiClient, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(NAMSHI_MARKETPLACE_KEY);
        this.deploymentApiBaseUrl = deps.deploymentApiBaseUrl;
        this.deploymentUserAgent = deps.deploymentUserAgent;
        this.api = deps.api ?? new NamshiApiClient({
            deploymentApiBaseUrl: deps.deploymentApiBaseUrl,
            deploymentUserAgent: deps.deploymentUserAgent,
        });
    }

    getCapabilities() {
        return {
            ...createEmptyMarketplaceCapabilities(),
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
            await this.api.whoami(runtime);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncInventory(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            this.assertCapability(this.getCapabilities(), 'supportsInventorySync', 'inventory sync');
            const partnerSku = resolveNamshiPartnerSku(input.externalCatalogIdentifier, '');
            await this.api.updateStock(runtime, partnerSku, input.availableQuantity);
            return partnerSkuMappingHints('product', input.productId, partnerSku);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncPrice(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            this.assertCapability(this.getCapabilities(), 'supportsPriceSync', 'price sync');
            const partnerSku = resolveNamshiPartnerSku(input.externalCatalogIdentifier, '');
            const price = input.amountMinor / 100;
            await this.api.upsertLocalPricing(runtime, partnerSku, price);
            return partnerSkuMappingHints('product', input.productId, partnerSku);
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceProductSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncProduct(_input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncProduct');
            throw new MarketplaceUnsupportedError(
                'Namshi product sync is not supported; catalog SKUs must exist in Namshi before Nexora syncs stock and pricing',
            );
        });
    }

    /** @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncOffer(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncOffer');
            this.assertCapability(this.getCapabilities(), 'supportsOfferSync', 'offer sync');
            const partnerSku = resolveNamshiPartnerSku(input.externalCatalogIdentifier, input.merchantSku);
            const countryCode = readNamshiCountryCode(runtime.configuration ?? {});
            if (input.operation === 'deactivate' || !shouldKeepOfferActive(input)) {
                this.assertCapability(this.getCapabilities(), 'supportsDeactivation', 'deactivation');
                await this.api.updateStock(runtime, partnerSku, 0);
                return partnerSkuMappingHints('offer', input.offerId, partnerSku, 'product', input.productId);
            }
            if (input.operation === 'activate') {
                this.assertCapability(this.getCapabilities(), 'supportsActivation', 'activation');
            }
            const offersResponse = await this.api.getProductOffers(runtime, partnerSku);
            return buildOfferMappingHints(input, partnerSku, offersResponse.json, countryCode);
        });
    }
}

/**
 * @param {{ operation: string, offerStatus: string, productStatus?: string }} input
 */
function shouldKeepOfferActive(input) {
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

/**
 * @param {'product'|'offer'} nexoraEntityType
 * @param {string} nexoraEntityId
 * @param {string} partnerSku
 * @param {'product'|'offer'} [secondEntityType]
 * @param {string} [secondEntityId]
 */
function partnerSkuMappingHints(nexoraEntityType, nexoraEntityId, partnerSku, secondEntityType, secondEntityId) {
    const hints = [{
        nexoraEntityType,
        nexoraEntityId,
        externalEntityType: NamshiExternalEntityType.PARTNER_SKU,
        externalEntityId: partnerSku,
    }];
    if (secondEntityType !== undefined && secondEntityId !== undefined) {
        hints.push({
            nexoraEntityType: secondEntityType,
            nexoraEntityId: secondEntityId,
            externalEntityType: NamshiExternalEntityType.PARTNER_SKU,
            externalEntityId: partnerSku,
        });
    }
    return hints;
}

/**
 * @param {import('../../../../channel-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input
 * @param {string} partnerSku
 * @param {unknown} payload
 * @param {string} countryCode
 */
function buildOfferMappingHints(input, partnerSku, payload, countryCode) {
    /** @type {import('../../../../channel-catalog-sync/public/marketplace-entity-mapping-recorder.port.js').MarketplaceEntityMappingHint[]} */
    const hints = [
        {
            nexoraEntityType: 'offer',
            nexoraEntityId: input.offerId,
            externalEntityType: NamshiExternalEntityType.PARTNER_SKU,
            externalEntityId: partnerSku,
        },
        {
            nexoraEntityType: 'product',
            nexoraEntityId: input.productId,
            externalEntityType: NamshiExternalEntityType.PARTNER_SKU,
            externalEntityId: partnerSku,
        },
    ];
    const catalogSku = typeof payload?.sku === 'string' ? payload.sku.trim() : '';
    if (catalogSku.length > 0) {
        hints.push({
            nexoraEntityType: 'product',
            nexoraEntityId: input.productId,
            externalEntityType: NamshiExternalEntityType.CATALOG_SKU,
            externalEntityId: catalogSku,
        });
    }
    const offers = Array.isArray(payload?.offers) ? payload.offers : [];
    const match = offers.find((offer) => typeof offer?.country_code === 'string'
        && offer.country_code.toLowerCase() === countryCode);
    const offerCode = typeof match?.offer_code === 'string' ? match.offer_code.trim() : '';
    if (offerCode.length > 0) {
        hints.push({
            nexoraEntityType: 'offer',
            nexoraEntityId: input.offerId,
            externalEntityType: NamshiExternalEntityType.OFFER,
            externalEntityId: offerCode,
        });
    }
    return hints;
}
