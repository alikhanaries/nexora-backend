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
 * @typedef {object} MarketplaceCatalogAdapter
 * @property {string} marketplaceKey
 * @property {(context: MarketplaceCatalogSyncContext) => Promise<void>} [execute]
 * @property {(input: MarketplaceInventorySyncInput) => Promise<void>} [syncInventory]
 * @property {(input: MarketplacePriceSyncInput) => Promise<void>} [syncPrice]
 * @property {(input: MarketplaceProductSyncInput) => Promise<void>} [syncProduct]
 * @property {(input: MarketplaceOfferSyncInput) => Promise<void>} [syncOffer]
 */

export const FOUNDATION_STUB_MARKETPLACE_KEY = 'nexora-foundation-stub';
