/**
 * Provider-specific outbound marketplace order lifecycle (Shopify GraphQL, etc.).
 *
 * @typedef {import('../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} MarketplaceAdapterRuntime
 *
 * @typedef {object} MarketplaceOutboundOrderLifecycleCapabilities
 * @property {boolean} supportsOutboundCancellation
 * @property {boolean} supportsOutboundRefund
 * @property {boolean} supportsOutboundFulfillment
 * @property {boolean} supportsOutboundReturns
 *
 * @typedef {object} MarketplaceOutboundOrderLifecycleContext
 * @property {string} tenantId
 * @property {string} channelId
 * @property {string} marketplaceKey
 * @property {string} externalOrderId
 * @property {string|null} correlationId
 *
 * @typedef {object} MarketplaceOrderCancelRequest
 * @property {string|null} [reason]
 * @property {boolean} [restock]
 * @property {boolean} [notifyCustomer]
 *
 * @typedef {object} MarketplaceOrderRefundLineRequest
 * @property {string} externalLineItemId
 * @property {number} quantity
 *
 * @typedef {object} MarketplaceOrderRefundRequest
 * @property {MarketplaceOrderRefundLineRequest[]} [lines]
 * @property {boolean} [refundShipping]
 * @property {string|null} [note]
 *
 * @typedef {object} MarketplaceFulfillmentLineRequest
 * @property {string} externalLineItemId
 * @property {number} quantity
 *
 * @typedef {object} MarketplaceCreateFulfillmentRequest
 * @property {MarketplaceFulfillmentLineRequest[]} lines
 * @property {string|null} [trackingNumber]
 * @property {string|null} [trackingUrl]
 * @property {string|null} [carrier]
 * @property {boolean} [notifyCustomer]
 *
 * @typedef {object} MarketplaceOutboundOrderLifecycleResult
 * @property {string} outcome
 * @property {string|null} [providerReference]
 * @property {Record<string, unknown>} [providerMetadata]
 *
 * @typedef {object} MarketplaceOutboundOrderLifecycleAdapter
 * @property {string} marketplaceKey
 * @property {() => MarketplaceOutboundOrderLifecycleCapabilities} getLifecycleCapabilities
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOutboundOrderLifecycleContext, request: MarketplaceOrderCancelRequest) => Promise<MarketplaceOutboundOrderLifecycleResult>} [cancelOrder]
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOutboundOrderLifecycleContext, request: MarketplaceOrderRefundRequest) => Promise<MarketplaceOutboundOrderLifecycleResult>} [refundOrder]
 * @property {(runtime: MarketplaceAdapterRuntime, context: MarketplaceOutboundOrderLifecycleContext, request: MarketplaceCreateFulfillmentRequest) => Promise<MarketplaceOutboundOrderLifecycleResult>} [createFulfillment]
 */

export {};
