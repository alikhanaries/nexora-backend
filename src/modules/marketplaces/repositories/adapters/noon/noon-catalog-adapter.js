import { createEmptyMarketplaceCapabilities } from '../../../models/marketplace-capabilities.js';
import { MarketplaceUnsupportedError } from '../../../models/marketplace-errors.js';
import { BaseMarketplaceCatalogAdapter } from '../base-marketplace-catalog-adapter.js';
import { NoonApiClient } from './noon-api-client.js';
import { readNoonCountryCode, resolveNoonPartnerSku } from './noon-config.js';
import { NoonExternalEntityType } from './noon-external-entity-types.js';

export const NOON_MARKETPLACE_KEY = 'noon';

/**
 * Noon Partners API adapter (service-account JWT login + cookie session).
 * Product catalog creation is not wired — offers are expected to exist in Seller Lab / prior setup.
 */
export class NoonCatalogAdapter extends BaseMarketplaceCatalogAdapter {
    api;
    /** @type {string | null | undefined} */
    deploymentApiBaseUrl;
    /** @type {string | null | undefined} */
    deploymentUserAgent;

    /**
     * @param {{ api?: NoonApiClient, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null, catalogWritesEnabled?: boolean, testLaneBlockExternalHttp?: boolean, logger?: import('../../../../../shared/logging/logger.port.js').Logger }} [deps]
     */
    constructor(deps = {}) {
        super(NOON_MARKETPLACE_KEY);
        this.deploymentApiBaseUrl = deps.deploymentApiBaseUrl;
        this.deploymentUserAgent = deps.deploymentUserAgent;
        this.api = deps.api ?? new NoonApiClient({
            deploymentApiBaseUrl: deps.deploymentApiBaseUrl,
            deploymentUserAgent: deps.deploymentUserAgent,
            catalogWritesEnabled: deps.catalogWritesEnabled ?? false,
            testLaneBlockExternalHttp: deps.testLaneBlockExternalHttp ?? false,
            ...(deps.logger === undefined ? {} : { logger: deps.logger }),
        });
    }

    /**
     * Static catalog adapter capability flags (sync dimensions, connection test). No network I/O.
     */
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

    /** @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime */
    async testConnection(runtime) {
        return this.run(async () => {
            this.assertRuntime(runtime, 'testConnection');
            await this.api.whoami(runtime);
        });
    }

    /** @param {import('../../../../integration-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceInventorySyncInput} input @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncInventory(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncInventory');
            this.assertCapability(this.getCapabilities(), 'supportsInventorySync', 'inventory sync');
            const partnerSku = resolveNoonPartnerSku(input.externalCatalogIdentifier, '');
            await this.api.updateStock(runtime, partnerSku, input.availableQuantity);
            // Stock update is keyed by partner_sku from the active offer; it does not return catalog
            // product identity. Partner SKU is already on offers.external_reference for sync input.
            return [];
        });
    }

    /** @param {import('../../../../integration-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplacePriceSyncInput} input @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncPrice(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncPrice');
            this.assertCapability(this.getCapabilities(), 'supportsPriceSync', 'price sync');
            const partnerSku = resolveNoonPartnerSku(input.externalCatalogIdentifier, '');
            const price = input.amountMinor / 100;
            await this.api.upsertPricing(runtime, partnerSku, price);
            // Price upsert is keyed by partner_sku input; the response does not establish a new
            // product identity. Persist catalog SKU / offer code from offer sync (getProductOffers).
            return [];
        });
    }

    /** @param {import('../../../../integration-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceProductSyncInput} input @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncProduct(_input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncProduct');
            throw new MarketplaceUnsupportedError(
                'Noon product sync is not supported; catalog SKUs must exist in noon before Wasl syncs stock and pricing',
            );
        });
    }

    /** @param {import('../../../../integration-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input @param {import('../../../../integration-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} [runtime] */
    async syncOffer(input, runtime) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'syncOffer');
            this.assertCapability(this.getCapabilities(), 'supportsOfferSync', 'offer sync');
            const partnerSku = resolveNoonPartnerSku(input.externalCatalogIdentifier, input.merchantSku);
            const countryCode = readNoonCountryCode(runtime.configuration ?? {});
            if (input.operation === 'deactivate' || !shouldKeepOfferActive(input)) {
                this.assertCapability(this.getCapabilities(), 'supportsDeactivation', 'deactivation');
                await this.api.setOfferActive(runtime, partnerSku, false);
                return partnerSkuMappingHints('offer', input.offerId, partnerSku);
            }
            if (input.operation === 'activate') {
                this.assertCapability(this.getCapabilities(), 'supportsActivation', 'activation');
                await this.api.setOfferActive(runtime, partnerSku, true);
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
 * @param {'product'|'offer'} integrationEntityType
 * @param {string} integrationEntityId
 * @param {string} partnerSku
 * @param {'product'|'offer'} [secondEntityType]
 * @param {string} [secondEntityId]
 */
function partnerSkuMappingHints(integrationEntityType, integrationEntityId, partnerSku, secondEntityType, secondEntityId) {
    const hints = [{
        integrationEntityType,
        integrationEntityId,
        externalEntityType: NoonExternalEntityType.PARTNER_SKU,
        externalEntityId: partnerSku,
    }];
    if (secondEntityType !== undefined && secondEntityId !== undefined) {
        hints.push({
            integrationEntityType: secondEntityType,
            integrationEntityId: secondEntityId,
            externalEntityType: NoonExternalEntityType.PARTNER_SKU,
            externalEntityId: partnerSku,
        });
    }
    return hints;
}

/**
 * @param {import('../../../../integration-catalog-sync/public/marketplace-catalog-adapter.port.js').MarketplaceOfferSyncInput} input
 * @param {string} partnerSku
 * @param {unknown} payload
 * @param {string} countryCode
 */
function buildOfferMappingHints(input, partnerSku, payload, countryCode) {
    /** @type {import('../../../../integration-catalog-sync/public/marketplace-entity-mapping-recorder.port.js').MarketplaceEntityMappingHint[]} */
    const hints = [
        {
            integrationEntityType: 'offer',
            integrationEntityId: input.offerId,
            externalEntityType: NoonExternalEntityType.PARTNER_SKU,
            externalEntityId: partnerSku,
        },
    ];
    const catalogSku = typeof payload?.sku === 'string' ? payload.sku.trim() : '';
    if (catalogSku.length > 0) {
        hints.push({
            integrationEntityType: 'product',
            integrationEntityId: input.productId,
            externalEntityType: NoonExternalEntityType.CATALOG_SKU,
            externalEntityId: catalogSku,
        });
    }
    const offers = Array.isArray(payload?.offers) ? payload.offers : [];
    const match = offers.find((offer) => typeof offer?.country_code === 'string'
        && offer.country_code.toLowerCase() === countryCode);
    const offerCode = typeof match?.offer_code === 'string' ? match.offer_code.trim() : '';
    if (offerCode.length > 0) {
        hints.push({
            integrationEntityType: 'offer',
            integrationEntityId: input.offerId,
            externalEntityType: NoonExternalEntityType.OFFER,
            externalEntityId: offerCode,
        });
    }
    return hints;
}
