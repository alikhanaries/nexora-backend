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
 * @typedef {object} MarketplaceCatalogAdapter
 * @property {string} marketplaceKey
 * @property {(context: MarketplaceCatalogSyncContext) => Promise<void>} [execute]
 * @property {(input: MarketplaceInventorySyncInput) => Promise<void>} [syncInventory]
 */

export const FOUNDATION_STUB_MARKETPLACE_KEY = 'nexora-foundation-stub';
