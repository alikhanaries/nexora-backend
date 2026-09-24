/**
 * Marketplace-agnostic catalog synchronization adapter (ADR-028 §10).
 *
 * @typedef {object} MarketplaceCatalogSyncContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} target
 * @property {string} entityId
 * @property {string} operation
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 * @property {string} [stockLocationId]
 *
 * @typedef {object} MarketplaceInventorySyncInput
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} productId
 * @property {string} externalCatalogIdentifier
 * @property {string} stockLocationId
 * @property {number} availableQuantity
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplacePriceSyncInput
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} productId
 * @property {string} externalCatalogIdentifier
 * @property {string} currency
 * @property {number} amountMinor
 * @property {string} validFrom
 * @property {string|null} validTo
 * @property {string} priceId
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceProductSyncInput
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} productId
 * @property {string} merchantSku
 * @property {string} productType
 * @property {string} productStatus
 * @property {string|null} productExternalReference
 * @property {string} externalCatalogIdentifier
 * @property {string} offerStatus
 * @property {string} listingStatus
 * @property {string} operation
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceOfferSyncInput
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} offerId
 * @property {string} productId
 * @property {string} merchantSku
 * @property {string|null} productExternalReference
 * @property {string} externalCatalogIdentifier
 * @property {string} offerStatus
 * @property {string} listingStatus
 * @property {string} operation
 * @property {string} sourceEventId
 * @property {string|null} correlationId
 *
 * @typedef {import('./marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} MarketplaceAdapterRuntime
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
 *
 * @typedef {object} MarketplaceCatalogAdapter
 * @property {string} marketplaceKey
 * @property {() => MarketplaceCatalogCapabilities} [getCapabilities]
 * @property {(runtime: MarketplaceAdapterRuntime) => Promise<void>} [testConnection]
 * @property {(context: MarketplaceCatalogSyncContext) => Promise<void>} [execute]
 * @property {(input: MarketplaceInventorySyncInput, runtime?: MarketplaceAdapterRuntime) => Promise<import('./marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncResult>} [syncInventory]
 * @property {(input: MarketplacePriceSyncInput, runtime?: MarketplaceAdapterRuntime) => Promise<import('./marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncResult>} [syncPrice]
 * @property {(input: MarketplaceProductSyncInput, runtime?: MarketplaceAdapterRuntime) => Promise<import('./marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncResult>} [syncProduct]
 * @property {(input: MarketplaceOfferSyncInput, runtime?: MarketplaceAdapterRuntime) => Promise<import('./marketplace-entity-mapping-recorder.port.js').MarketplaceCatalogSyncResult>} [syncOffer]
 */

export const FOUNDATION_STUB_MARKETPLACE_KEY = 'nexora-foundation-stub';
