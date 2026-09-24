/**
 * @typedef {object} MarketplaceSnapshot
 * @property {string} id
 * @property {string} key
 * @property {string} status
 *
 * @typedef {object} MarketplaceLookup
 * @property {(marketplaceId: string) => Promise<MarketplaceSnapshot|null>} findById
 */

export {};
