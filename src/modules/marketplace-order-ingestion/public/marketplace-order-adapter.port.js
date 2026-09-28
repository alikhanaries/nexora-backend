/**
 * Provider-neutral inbound marketplace order adapter (Phase 28).
 *
 * @typedef {import('./normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder} NormalizedMarketplaceOrder
 * @typedef {import('../application/normalized-marketplace-lifecycle-command.schema.js').normalizedMarketplaceLifecycleCommandSchema['_output']} NormalizedMarketplaceLifecycleCommand
 * @typedef {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} MarketplaceAdapterRuntime
 *
 * @typedef {object} MarketplaceOrderCapabilities
 * @property {boolean} supportsOrdersInbound
 * @property {boolean} supportsOrderWebhookIngestion
 * @property {boolean} supportsOrderPolling
 *
 * @typedef {object} MarketplaceOrderLifecycleCapabilities
 * @property {boolean} supportsOrderUpdate
 * @property {boolean} supportsOrderCancel
 * @property {boolean} supportsOrderReturn
 * @property {boolean} supportsOrderRefund
 * @property {boolean} supportsOrderFulfill
 * @property {boolean} supportsShipmentUpdate
 * @property {boolean} supportsOrderStatusSync
 *
 * @typedef {object} MarketplaceOrderLifecycleContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} [stockLocationId]
 * @property {string} [externalOrderId]
 *
 * @typedef {object} MarketplaceOrderFetchContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} externalOrderId
 * @property {string} stockLocationId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceOrderListContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} stockLocationId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceOrderListOptions
 * @property {number} first
 * @property {string|null} [after]
 * @property {string|null} [query]
 *
 * @typedef {object} MarketplaceOrderListPage
 * @property {NormalizedMarketplaceOrder[]} orders
 * @property {boolean} hasNextPage
 * @property {string|null} endCursor
 *
 * @typedef {object} MarketplaceOrderAdapter
 * @property {string} marketplaceKey
 * @property {() => MarketplaceOrderCapabilities} [getOrderCapabilities]
 * @property {() => MarketplaceOrderLifecycleCapabilities} [getOrderLifecycleCapabilities]
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOrderFetchContext) => Promise<NormalizedMarketplaceOrder>} [fetchOrder]
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOrderListContext, options: MarketplaceOrderListOptions) => Promise<MarketplaceOrderListPage>} [listOrders]
 * @property {(payload: unknown, runtime: MarketplaceAdapterRuntime | undefined, context: MarketplaceOrderLifecycleContext) => Promise<NormalizedMarketplaceLifecycleCommand>} [normalizeLifecycleCommand]
 * @property {(payload: unknown, runtime: MarketplaceAdapterRuntime | undefined, context: MarketplaceOrderLifecycleContext) => Promise<NormalizedMarketplaceOrder>} [normalizeOrderFromLifecyclePayload]
 * @property {(payload: unknown, runtime: MarketplaceAdapterRuntime, context: { tenantId: string, channelId: string, marketplaceKey: string }) => Promise<NormalizedMarketplaceOrder>} [normalizeWebhookOrder]
 */

export {};
