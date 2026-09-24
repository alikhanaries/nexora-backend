import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { SHOPIFY_MARKETPLACE_KEY } from './shopify-catalog-adapter.js';
import { ShopifyGraphqlClient } from './shopify-graphql-client.js';
import { mapShopifyOrderToNormalized } from './map-shopify-order-to-normalized.js';
import { SHOPIFY_ORDER_BY_ID_QUERY, SHOPIFY_ORDERS_LIST_QUERY } from './shopify-order-fields.js';
import { toShopifyOrderGid } from './shopify-order-gid.js';

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 250;

/**
 * @param {number} first
 */
function clampOrderPageSize(first) {
    const value = Number.isFinite(first) ? Math.trunc(first) : MIN_PAGE_SIZE;
    return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, value));
}

export class ShopifyOrderAdapter extends BaseMarketplaceOrderAdapter {
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

    getOrderCapabilities() {
        return {
            supportsOrdersInbound: true,
            supportsOrderWebhookIngestion: false,
            supportsOrderPolling: true,
        };
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderFetchContext} context
     */
    async fetchOrder(runtime, context) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'fetchOrder');
            if (context.stockLocationId.trim().length === 0) {
                throw new MarketplaceValidationError('stockLocationId is required for Shopify order fetch');
            }
            const data = await this.graphql.execute(runtime, SHOPIFY_ORDER_BY_ID_QUERY, {
                id: toShopifyOrderGid(context.externalOrderId),
            });
            const shopifyOrder = data?.order;
            if (shopifyOrder === null || shopifyOrder === undefined) {
                throw new MarketplaceValidationError('Shopify order was not found');
            }
            return mapShopifyOrderToNormalized(shopifyOrder, {
                marketplaceKey: this.marketplaceKey,
                stockLocationId: context.stockLocationId,
            });
        });
    }

    /**
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderListContext} context
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderListOptions} options
     */
    async listOrders(runtime, context, options) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'listOrders');
            if (context.stockLocationId.trim().length === 0) {
                throw new MarketplaceValidationError('stockLocationId is required for Shopify order list');
            }
            const first = clampOrderPageSize(options.first);
            const variables = {
                first,
                after: options.after ?? null,
                query: options.query ?? null,
            };
            const data = await this.graphql.execute(runtime, SHOPIFY_ORDERS_LIST_QUERY, variables);
            const connection = data?.orders;
            if (connection === null || connection === undefined || typeof connection !== 'object') {
                throw new MarketplaceValidationError('Shopify orders connection is invalid');
            }
            const edges = Array.isArray(connection.edges) ? connection.edges : [];
            /** @type {import('../../../../marketplace-order-ingestion/public/normalized-marketplace-order.schema.js').NormalizedMarketplaceOrder[]} */
            const orders = [];
            for (const edge of edges) {
                const node = edge?.node;
                if (node === null || node === undefined) {
                    continue;
                }
                orders.push(mapShopifyOrderToNormalized(node, {
                    marketplaceKey: this.marketplaceKey,
                    stockLocationId: context.stockLocationId,
                }));
            }
            const pageInfo = connection.pageInfo ?? {};
            return {
                orders,
                hasNextPage: pageInfo.hasNextPage === true,
                endCursor: typeof pageInfo.endCursor === 'string' ? pageInfo.endCursor : null,
            };
        });
    }
}
