/**
 * Provider-owned capability flags for catalog sync operations.
 *
 * @typedef {object} MarketplaceCatalogCapabilities
 * @property {boolean} supportsProductSync
 * @property {boolean} supportsOfferSync
 * @property {boolean} supportsInventorySync
 * @property {boolean} supportsPriceSync
 * @property {boolean} supportsActivation
 * @property {boolean} supportsDeactivation
 * @property {boolean} supportsConnectionTest
 * @property {boolean} supportsInboundCatalog
 * @property {boolean} supportsOrdersInbound
 */

/** @returns {MarketplaceCatalogCapabilities} */
export function createEmptyMarketplaceCapabilities() {
    return {
        supportsProductSync: false,
        supportsOfferSync: false,
        supportsInventorySync: false,
        supportsPriceSync: false,
        supportsActivation: false,
        supportsDeactivation: false,
        supportsConnectionTest: false,
        supportsInboundCatalog: false,
        supportsOrdersInbound: false,
    };
}
