import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { NAMSHI_MARKETPLACE_KEY } from './namshi-catalog-adapter.js';
import { NamshiApiClient } from './namshi-api-client.js';
import {
    buildNamshiFbpiLifecycleEventId,
    mapNamshiFbpiOrderToLifecycleCommand,
    normalizeNamshiLifecyclePayload,
} from './map-namshi-fbpi-order-to-lifecycle-command.js';
import { namshiOrderLifecycleCapabilities } from './namshi-order-lifecycle-capabilities.js';
import { parseNamshiFbpiWebhookEvent } from './parse-namshi-fbpi-webhook-event.js';

export class NamshiOrderAdapter extends BaseMarketplaceOrderAdapter {
    api;

    /**
     * @param {{ api?: NamshiApiClient, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(NAMSHI_MARKETPLACE_KEY);
        this.api = deps.api ?? new NamshiApiClient({
            deploymentApiBaseUrl: deps.deploymentApiBaseUrl,
            deploymentUserAgent: deps.deploymentUserAgent,
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
        return namshiOrderLifecycleCapabilities();
    }

    /**
     * @param {unknown} payload
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime | undefined} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderLifecycleContext} context
     */
    async normalizeLifecycleCommand(payload, runtime, context) {
        return this.runWithResult(async () => {
            if (payload !== null && typeof payload === 'object' && payload.source === 'fbpi_get_order') {
                this.assertRuntime(runtime, 'normalizeLifecycleCommand');
                const externalEventId = typeof payload.externalEventId === 'string' ? payload.externalEventId.trim() : '';
                if (externalEventId.length === 0) {
                    throw new MarketplaceValidationError('externalEventId is required for Namshi FBPI getOrder lifecycle sync');
                }
                let orderPayload = payload.orderPayload;
                if (orderPayload === undefined) {
                    const fbpiOrderNr = typeof payload.fbpiOrderNr === 'string' ? payload.fbpiOrderNr.trim() : '';
                    if (fbpiOrderNr.length === 0) {
                        throw new MarketplaceValidationError('fbpiOrderNr is required when orderPayload is omitted');
                    }
                    const response = await this.api.getFbpiOrder(runtime, fbpiOrderNr);
                    orderPayload = response.json;
                }
                return mapNamshiFbpiOrderToLifecycleCommand({
                    marketplaceKey: context.marketplaceKey,
                    orderPayload,
                    externalEventId,
                });
            }
            if (payload !== null && typeof payload === 'object' && payload.source === 'fbpi_order_sync') {
                this.assertRuntime(runtime, 'normalizeLifecycleCommand');
                const parsed = parseNamshiFbpiWebhookEvent(payload.event);
                const externalEventId = buildNamshiFbpiLifecycleEventId({
                    messageId: parsed.messageId,
                    orderNr: parsed.orderNr,
                    publishedAt: parsed.publishedAt,
                    eventType: parsed.eventType,
                });
                let orderPayload = payload.orderPayload;
                if (orderPayload === undefined) {
                    const response = await this.api.getFbpiOrder(runtime, parsed.orderNr);
                    orderPayload = response.json;
                }
                return mapNamshiFbpiOrderToLifecycleCommand({
                    marketplaceKey: context.marketplaceKey,
                    orderPayload,
                    externalEventId,
                });
            }
            return normalizeNamshiLifecyclePayload(payload, context.marketplaceKey);
        });
    }

    /**
     * Poll a single Namshi FBPI order and return a lifecycle command (status sync).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderFetchContext} context
     * @param {string} externalEventId
     */
    async fetchOrderLifecycleCommand(runtime, context, externalEventId) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'fetchOrderLifecycleCommand');
            const response = await this.api.getFbpiOrder(runtime, context.externalOrderId);
            return mapNamshiFbpiOrderToLifecycleCommand({
                marketplaceKey: context.marketplaceKey,
                orderPayload: response.json,
                externalEventId,
            });
        });
    }
}
