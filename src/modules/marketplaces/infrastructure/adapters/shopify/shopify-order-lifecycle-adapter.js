import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { SHOPIFY_MARKETPLACE_KEY } from './shopify-catalog-adapter.js';
import { ShopifyGraphqlClient } from './shopify-graphql-client.js';
import {
    SHOPIFY_FULFILLMENT_CREATE_MUTATION,
    SHOPIFY_FULFILLMENT_ORDERS_QUERY,
    SHOPIFY_ORDER_CANCEL_MUTATION,
    SHOPIFY_REFUND_CREATE_MUTATION,
} from './shopify-order-lifecycle-mutations.js';
import { toShopifyOrderGid } from './shopify-order-gid.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';

export class ShopifyOrderLifecycleAdapter extends BaseMarketplaceOrderAdapter {
    graphql;

    /**
     * @param {{ graphql?: ShopifyGraphqlClient, deploymentDefaultApiVersion?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(SHOPIFY_MARKETPLACE_KEY);
        this.graphql = deps.graphql ?? new ShopifyGraphqlClient({
            deploymentDefaultApiVersion: deps.deploymentDefaultApiVersion,
        });
    }

    getLifecycleCapabilities() {
        return {
            supportsInboundStatusSync: true,
            supportsOutboundCancellation: true,
            supportsOutboundRefund: true,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        };
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOrderCancelRequest} request
     */
    async cancelOrder(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'cancelOrder');
            const data = await this.graphql.execute(runtime, SHOPIFY_ORDER_CANCEL_MUTATION, {
                orderId: toShopifyOrderGid(context.externalOrderId),
                reason: 'OTHER',
                restock: request.restock ?? true,
                notifyCustomer: request.notifyCustomer ?? false,
                refundMethod: {
                    originalPaymentMethodsRefund: true,
                },
            });
            const payload = data?.orderCancel;
            const userErrors = [
                ...(Array.isArray(payload?.orderCancelUserErrors) ? payload.orderCancelUserErrors : []),
                ...(Array.isArray(payload?.userErrors) ? payload.userErrors : []),
            ];
            if (userErrors.length > 0) {
                throw new MarketplaceValidationError(userErrors[0]?.message ?? 'Shopify orderCancel failed');
            }
            return {
                outcome: 'cancelled',
                providerReference: payload?.job?.id ?? null,
            };
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOrderRefundRequest} request
     */
    async refundOrder(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'refundOrder');
            const refundLineItems = (request.lines ?? []).map((line) => ({
                lineItemId: line.externalLineItemId.startsWith('gid://')
                    ? line.externalLineItemId
                    : `gid://shopify/LineItem/${line.externalLineItemId}`,
                quantity: line.quantity,
                restockType: 'RETURN',
            }));
            const input = {
                orderId: toShopifyOrderGid(context.externalOrderId),
                note: request.note ?? null,
                notify: false,
                ...(refundLineItems.length > 0 ? { refundLineItems } : {}),
                ...(request.refundShipping === true ? { shipping: { fullRefund: true } } : {}),
            };
            const data = await this.graphql.execute(runtime, SHOPIFY_REFUND_CREATE_MUTATION, { input });
            const userErrors = data?.refundCreate?.userErrors;
            if (Array.isArray(userErrors) && userErrors.length > 0) {
                throw new MarketplaceValidationError(userErrors[0]?.message ?? 'Shopify refundCreate failed');
            }
            return {
                outcome: 'refunded',
                providerReference: data?.refundCreate?.refund?.id ?? null,
            };
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
     */
    async createFulfillment(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'createFulfillment');
            const orderData = await this.graphql.execute(runtime, SHOPIFY_FULFILLMENT_ORDERS_QUERY, {
                orderId: toShopifyOrderGid(context.externalOrderId),
            });
            const fulfillmentOrders = orderData?.order?.fulfillmentOrders?.edges ?? [];
            if (!Array.isArray(fulfillmentOrders) || fulfillmentOrders.length === 0) {
                throw new MarketplaceValidationError('Shopify order has no fulfillment orders');
            }
            const lineItemsByFulfillmentOrder = buildFulfillmentOrderLines(fulfillmentOrders, request.lines);
            const trackingInfo = request.trackingNumber === null || request.trackingNumber === undefined
                ? undefined
                : [{
                    number: request.trackingNumber,
                    ...(request.trackingUrl === undefined || request.trackingUrl === null
                        ? {}
                        : { url: request.trackingUrl }),
                    ...(request.carrier === undefined || request.carrier === null
                        ? {}
                        : { company: request.carrier }),
                }];
            const data = await this.graphql.execute(runtime, SHOPIFY_FULFILLMENT_CREATE_MUTATION, {
                fulfillment: {
                    lineItemsByFulfillmentOrder,
                    notifyCustomer: request.notifyCustomer ?? false,
                    ...(trackingInfo === undefined ? {} : { trackingInfo }),
                },
                message: null,
            });
            const userErrors = data?.fulfillmentCreate?.userErrors;
            if (Array.isArray(userErrors) && userErrors.length > 0) {
                throw new MarketplaceValidationError(userErrors[0]?.message ?? 'Shopify fulfillmentCreate failed');
            }
            return {
                outcome: 'fulfilled',
                providerReference: data?.fulfillmentCreate?.fulfillment?.id ?? null,
            };
        });
    }
}

/**
 * @param {unknown[]} fulfillmentOrderEdges
 * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceFulfillmentLineRequest[]} requestedLines
 */
function buildFulfillmentOrderLines(fulfillmentOrderEdges, requestedLines) {
    /** @type {Map<string, number>} */
    const remainingByLineItem = new Map();
    for (const line of requestedLines) {
        const gid = line.externalLineItemId.startsWith('gid://')
            ? line.externalLineItemId
            : `gid://shopify/LineItem/${line.externalLineItemId}`;
        remainingByLineItem.set(gid, (remainingByLineItem.get(gid) ?? 0) + line.quantity);
    }
    /** @type {Array<{ fulfillmentOrderId: string, fulfillmentOrderLineItems: Array<{ id: string, quantity: number }> }>} */
    const result = [];
    for (const edge of fulfillmentOrderEdges) {
        const node = edge?.node;
        if (node === null || node === undefined) {
            continue;
        }
        const fulfillmentOrderId = node.id;
        const lineEdges = node.lineItems?.edges ?? [];
        /** @type {Array<{ id: string, quantity: number }>} */
        const fulfillmentOrderLineItems = [];
        for (const lineEdge of lineEdges) {
            const lineNode = lineEdge?.node;
            if (lineNode === null || lineNode === undefined) {
                continue;
            }
            const shopifyLineItemId = lineNode.lineItem?.id;
            if (typeof shopifyLineItemId !== 'string') {
                continue;
            }
            const requestedQty = remainingByLineItem.get(shopifyLineItemId);
            if (requestedQty === undefined || requestedQty <= 0) {
                continue;
            }
            const quantity = Math.min(requestedQty, Number(lineNode.remainingQuantity ?? 0));
            if (quantity <= 0) {
                continue;
            }
            fulfillmentOrderLineItems.push({ id: lineNode.id, quantity });
            remainingByLineItem.set(shopifyLineItemId, requestedQty - quantity);
        }
        if (fulfillmentOrderLineItems.length > 0) {
            result.push({ fulfillmentOrderId, fulfillmentOrderLineItems });
        }
    }
    if (result.length === 0) {
        throw new MarketplaceValidationError('No Shopify fulfillment order lines matched the request');
    }
    return result;
}
