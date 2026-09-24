/**
 * @typedef {object} MarketplaceAdapterRuntime
 * @property {string} marketplaceKey
 * @property {Record<string, unknown>} configuration
 * @property {Record<string, unknown>} credentials
 * @property {boolean} connectionRequired
 */

/**
 * @typedef {object} MarketplaceAdapterRuntimeFactory
 * @property {(input: { tenantId: string, channelId: string, marketplaceKey: string, tx?: object }) => Promise<MarketplaceAdapterRuntime|null>} createForSync
 */
