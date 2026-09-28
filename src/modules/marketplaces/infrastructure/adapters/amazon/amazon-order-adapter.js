import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { AMAZON_MARKETPLACE_KEY } from './amazon-catalog-adapter.js';
import { amazonOrderLifecycleCapabilities } from './amazon-order-lifecycle-capabilities.js';
import { normalizeAmazonLifecyclePayload } from './map-amazon-order-change-to-lifecycle-command.js';
import { mapAmazonSpApiOrderToLifecycleCommand } from './map-amazon-sp-api-order-to-lifecycle-command.js';
import { mapAmazonOrderToNormalizedMarketplaceOrder } from './map-amazon-order-to-normalized-marketplace-order.js';
import { AmazonSpApiClient } from './amazon-sp-api-client.js';

export class AmazonOrderAdapter extends BaseMarketplaceOrderAdapter {
    spApi;

    /**
     * @param {{ spApi?: AmazonSpApiClient, deploymentLwaTokenUrl?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(AMAZON_MARKETPLACE_KEY);
        this.spApi = deps.spApi ?? new AmazonSpApiClient({
            deploymentLwaTokenUrl: deps.deploymentLwaTokenUrl,
        });
    }

    getOrderCapabilities() {
        return {
            supportsOrdersInbound: false,
            supportsOrderWebhookIngestion: false,
            supportsOrderPolling: false,
        };
    }

    getOrderLifecycleCapabilities() {
        return amazonOrderLifecycleCapabilities();
    }

    /**
     * @param {unknown} payload
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime | undefined} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderLifecycleContext} context
     */
    async normalizeLifecycleCommand(payload, runtime, context) {
        return this.runWithResult(async () => {
            if (payload !== null && typeof payload === 'object' && payload.source === 'sp_api_get_order') {
                this.assertRuntime(runtime, 'normalizeLifecycleCommand');
                if (typeof payload.externalEventId !== 'string' || payload.externalEventId.trim().length === 0) {
                    throw new MarketplaceValidationError('externalEventId is required for Amazon getOrder lifecycle sync');
                }
                let orderPayload = payload.orderPayload;
                if (orderPayload === undefined) {
                    const amazonOrderId = typeof payload.amazonOrderId === 'string' ? payload.amazonOrderId.trim() : '';
                    if (amazonOrderId.length === 0) {
                        throw new MarketplaceValidationError('amazonOrderId is required when orderPayload is omitted');
                    }
                    const response = await this.spApi.getOrder(runtime, amazonOrderId);
                    orderPayload = response.json;
                }
                return mapAmazonSpApiOrderToLifecycleCommand({
                    marketplaceKey: context.marketplaceKey,
                    orderPayload,
                    externalEventId: payload.externalEventId.trim(),
                });
            }
            return normalizeAmazonLifecyclePayload(payload, context.marketplaceKey);
        });
    }

    /**
     * Poll a single Amazon order and return a lifecycle command (status sync).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderFetchContext} context
     * @param {string} externalEventId
     */
    async fetchOrderLifecycleCommand(runtime, context, externalEventId) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'fetchOrderLifecycleCommand');
            const response = await this.spApi.getOrder(runtime, context.externalOrderId);
            return mapAmazonSpApiOrderToLifecycleCommand({
                marketplaceKey: context.marketplaceKey,
                orderPayload: response.json,
                externalEventId,
            });
        });
    }

    /**
     * @param {unknown} payload
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime | undefined} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderLifecycleContext} context
     */
    async normalizeOrderFromLifecyclePayload(payload, runtime, context) {
        return this.runWithResult(async () => {
            if (typeof context.stockLocationId !== 'string') {
                throw new MarketplaceValidationError('stockLocationId is required for Amazon order ingestion');
            }
            const mappedFromNotification = tryMapAmazonNotificationPayload(payload, context);
            if (mappedFromNotification !== null) {
                return mappedFromNotification;
            }
            this.assertRuntime(runtime, 'normalizeOrderFromLifecyclePayload');
            const amazonOrderId = context.externalOrderId?.trim()
                ?? extractAmazonOrderIdFromPayload(payload);
            if (amazonOrderId === null || amazonOrderId.length === 0) {
                throw new MarketplaceValidationError('Amazon lifecycle payload is missing AmazonOrderId');
            }
            const [orderResponse, itemsResponse] = await Promise.all([
                this.spApi.getOrder(runtime, amazonOrderId),
                this.spApi.getOrderItems(runtime, amazonOrderId),
            ]);
            return mapAmazonOrderToNormalizedMarketplaceOrder({
                payload: {
                    Order: orderResponse.json?.payload?.Order ?? orderResponse.json?.Order,
                    OrderItems: itemsResponse.json?.payload?.OrderItems ?? itemsResponse.json?.OrderItems,
                },
            }, {
                marketplaceKey: context.marketplaceKey,
                stockLocationId: context.stockLocationId,
            });
        });
    }
}

/**
 * @param {unknown} payload
 * @param {object} context
 * @param {string} context.marketplaceKey
 * @param {string} context.stockLocationId
 */
function tryMapAmazonNotificationPayload(payload, context) {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }
    const notification = 'notification' in payload ? payload.notification : payload;
    try {
        return mapAmazonOrderToNormalizedMarketplaceOrder({ notification }, context);
    }
    catch {
        return null;
    }
}

/**
 * @param {unknown} payload
 */
function extractAmazonOrderIdFromPayload(payload) {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }
    if (typeof payload.amazonOrderId === 'string') {
        return payload.amazonOrderId.trim();
    }
    const notification = payload.notification;
    if (notification !== null && typeof notification === 'object') {
        const change = notification.Payload?.OrderChangeNotification;
        if (typeof change?.AmazonOrderId === 'string') {
            return change.AmazonOrderId.trim();
        }
    }
    return null;
}
