import { MarketplaceWebhookEventKind } from '../../../../marketplace-webhook-ingestion/public/marketplace-webhook-event-kind.js';
import {
    MarketplaceWebhookAuthenticationError,
    MarketplaceWebhookPermanentError,
    MarketplaceWebhookUnsupportedError,
} from '../../../../marketplace-webhook-ingestion/public/marketplace-webhook-errors.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { requireChannelStockLocationId } from '../../../../channels/public/index.js';
import { SHOPIFY_MARKETPLACE_KEY } from './shopify-catalog-adapter.js';
import { mapShopifyOrderToNormalized } from './map-shopify-order-to-normalized.js';
import { mapShopifyRestWebhookOrderToGraphqlShape } from './map-shopify-rest-webhook-order.js';
import { readShopifyWebhookSecret } from './shopify-config.js';
import { ShopifyWebhookTopic, SUPPORTED_SHOPIFY_WEBHOOK_TOPICS } from './shopify-webhook-topics.js';
import { verifyShopifyWebhookHmac } from './verify-shopify-webhook-hmac.js';
import { toShopifyOrderGid } from './shopify-order-gid.js';

export class ShopifyMarketplaceWebhookAdapter {
    deps;
    marketplaceKey = SHOPIFY_MARKETPLACE_KEY;

    /**
     * @param {object} deps
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntimeFactory} deps.marketplaceAdapterRuntimeFactory
     * @param {import('../../../../channels/public/index.js').DefaultChannelQueryService} deps.channelQueryService
     * @param {import('../../../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
     * @param {import('./shopify-order-adapter.js').ShopifyOrderAdapter} deps.shopifyOrderAdapter
     */
    constructor(deps) {
        this.deps = deps;
    }

    getWebhookCapabilities() {
        return { supportsInboundWebhooks: true };
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async authenticateWebhookRequest(context) {
        const runtime = await this.loadRuntime(context.connection);
        try {
            verifyShopifyWebhookHmac({
                rawBody: context.rawBody,
                hmacHeader: headerValue(context.headers['x-shopify-hmac-sha256']),
                webhookSecret: readShopifyWebhookSecret(runtime.credentials),
            });
        }
        catch (error) {
            if (error instanceof MarketplaceValidationError) {
                throw new MarketplaceWebhookAuthenticationError(error.message);
            }
            throw error;
        }
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookRequestContext} context
     */
    async normalizeWebhookEvent(context) {
        const topic = headerValue(context.headers['x-shopify-topic']);
        if (topic === null || !SUPPORTED_SHOPIFY_WEBHOOK_TOPICS.has(topic)) {
            throw new MarketplaceWebhookUnsupportedError('Shopify webhook topic is not supported', { topic });
        }
        const webhookId = headerValue(context.headers['x-shopify-webhook-id']);
        if (webhookId === null) {
            throw new MarketplaceWebhookPermanentError('Shopify webhook id header is missing');
        }
        let payload;
        try {
            payload = JSON.parse(context.rawBody);
        }
        catch {
            throw new MarketplaceWebhookPermanentError('Shopify webhook body is not valid JSON');
        }
        const normalizedOrder = await this.resolveNormalizedOrder(context, payload, topic);
        const eventKind = topic === ShopifyWebhookTopic.ORDERS_CREATE
            ? MarketplaceWebhookEventKind.ORDER_CREATE
            : MarketplaceWebhookEventKind.ORDER_UPDATE;
        return {
            deduplicationKey: `shopify:webhook:${webhookId}`,
            eventKind,
            marketplaceKey: this.marketplaceKey,
            resource: {
                type: 'order',
                order: normalizedOrder,
            },
            providerEventId: webhookId,
            providerTopic: topic,
        };
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookConnectionContext} connection
     * @param {unknown} payload
     * @param {string} topic
     */
    async resolveNormalizedOrder(connection, payload, topic) {
        const channel = await this.deps.channelQueryService.getChannelById(connection.tenantId, connection.channelId);
        const stockLocationId = requireChannelStockLocationId(channel);
        if (topic === ShopifyWebhookTopic.REFUNDS_CREATE || topic === ShopifyWebhookTopic.FULFILLMENTS_CREATE) {
            const orderId = extractRelatedOrderId(payload);
            return this.deps.database.execute(async (tx) => {
                const runtimeInTx = await this.deps.marketplaceAdapterRuntimeFactory.createForSync({
                    tenantId: connection.tenantId,
                    channelId: connection.channelId,
                    marketplaceKey: connection.marketplaceKey,
                    tx,
                });
                return this.deps.shopifyOrderAdapter.fetchOrder(runtimeInTx, {
                    tenantId: connection.tenantId,
                    channelId: connection.channelId,
                    marketplaceKey: connection.marketplaceKey,
                    externalOrderId: orderId,
                    stockLocationId,
                    correlationId: null,
                });
            }, { tenantId: connection.tenantId });
        }
        const graphqlOrder = mapShopifyRestWebhookOrderToGraphqlShape(payload);
        return mapShopifyOrderToNormalized(graphqlOrder, {
            marketplaceKey: this.marketplaceKey,
            stockLocationId,
        });
    }

    /**
     * @param {import('../../../../marketplace-webhook-ingestion/public/marketplace-webhook-adapter.port.js').MarketplaceWebhookConnectionContext} connection
     */
    async loadRuntime(connection) {
        return this.deps.database.execute(async (tx) => this.deps.marketplaceAdapterRuntimeFactory.createForSync({
            tenantId: connection.tenantId,
            channelId: connection.channelId,
            marketplaceKey: connection.marketplaceKey,
            tx,
        }), { tenantId: connection.tenantId });
    }
}

/**
 * @param {string | string[] | undefined} value
 */
function headerValue(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        return headerValue(value[0]);
    }
    return null;
}

/**
 * @param {unknown} payload
 */
function extractRelatedOrderId(payload) {
    if (payload === null || typeof payload !== 'object') {
        throw new MarketplaceWebhookPermanentError('Shopify webhook payload is invalid');
    }
    const record = /** @type {Record<string, unknown>} */ (payload);
    const orderId = record.order_id ?? record.orderId;
    if (orderId === undefined || orderId === null) {
        throw new MarketplaceWebhookPermanentError('Shopify webhook payload is missing order id');
    }
    return toShopifyOrderGid(String(orderId));
}
