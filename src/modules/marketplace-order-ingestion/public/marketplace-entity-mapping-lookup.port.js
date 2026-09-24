/**
 * Resolve catalog sync entity mappings for inbound order lines.
 *
 * @typedef {object} MarketplaceEntityMappingLookupResult
 * @property {'product'|'offer'|'stock_location'} nexoraEntityType
 * @property {string} nexoraEntityId
 * @property {string} externalEntityType
 * @property {string} externalEntityId
 *
 * @typedef {object} MarketplaceEntityMappingLookup
 * @property {(input: {
 *   tenantId: string,
 *   channelId: string,
 *   marketplaceKey: string,
 *   externalEntityType: string,
 *   externalEntityId: string,
 *   queryable?: object,
 * }) => Promise<MarketplaceEntityMappingLookupResult|null>} findByExternalEntity
 */

export {};
