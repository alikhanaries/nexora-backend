/**
 * Provider-neutral inbound marketplace order adapter (Phase 28).
 *
 * @typedef {import('./normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder} NormalizedMarketplaceOrder
 * @typedef {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} MarketplaceAdapterRuntime
 *
 * @typedef {object} MarketplaceOrderCapabilities
 * @property {boolean} supportsOrdersInbound
 * @property {boolean} supportsOrderWebhookIngestion
 * @property {boolean} supportsOrderPolling
 *
 * @typedef {object} MarketplaceOrderFetchContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} externalOrderId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceOrderAdapter
 * @property {string} marketplaceKey
 * @property {() => MarketplaceOrderCapabilities} [getOrderCapabilities]
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOrderFetchContext) => Promise<NormalizedMarketplaceOrder>} [fetchOrder]
 * @property {(payload: unknown, runtime: MarketplaceAdapterRuntime, context: { tenantId: string, channelId: string, marketplaceKey: string }) => Promise<NormalizedMarketplaceOrder>} [normalizeWebhookOrder]
 */

export {};
