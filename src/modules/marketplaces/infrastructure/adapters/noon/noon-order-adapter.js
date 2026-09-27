import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { NOON_MARKETPLACE_KEY } from './noon-catalog-adapter.js';
import { NoonApiClient } from './noon-api-client.js';
import { noonOrderLifecycleCapabilities } from './noon-order-lifecycle-capabilities.js';
import {
    mapNoonFbpiOrderToLifecycleCommand,
    normalizeNoonLifecyclePayload,
} from './map-noon-fbpi-order-to-lifecycle-command.js';
import {
    buildNoonLifecycleExternalEventId,
    NOON_FBPI_ORDER_SYNC_EVENT_TYPE,
    readNoonEventOrderNr,
} from './parse-noon-event-notification.js';

export class NoonOrderAdapter extends BaseMarketplaceOrderAdapter {
    api;

    /**
     * @param {{ api?: NoonApiClient, deploymentApiBaseUrl?: string | null, deploymentUserAgent?: string | null }} [deps]
     */
    constructor(deps = {}) {
        super(NOON_MARKETPLACE_KEY);
        this.api = deps.api ?? new NoonApiClient({
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
        return noonOrderLifecycleCapabilities();
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
                if (typeof payload.externalEventId !== 'string' || payload.externalEventId.trim().length === 0) {
                    throw new MarketplaceValidationError('externalEventId is required for Noon getOrder lifecycle sync');
                }
                let orderPayload = payload.orderPayload;
                if (orderPayload === undefined) {
                    const orderNr = typeof payload.orderNr === 'string' ? payload.orderNr.trim() : '';
                    if (orderNr.length === 0) {
                        throw new MarketplaceValidationError('orderNr is required when orderPayload is omitted');
                    }
                    const response = await this.api.getFbpiOrder(runtime, orderNr);
                    orderPayload = response.json;
                }
                return mapNoonFbpiOrderToLifecycleCommand({
                    marketplaceKey: context.marketplaceKey,
                    orderPayload,
                    externalEventId: payload.externalEventId.trim(),
                });
            }
            if (payload !== null && typeof payload === 'object' && payload.noonEvent !== undefined) {
                return this.normalizeFromNoonEvent(payload.noonEvent, runtime, context.marketplaceKey);
            }
            return normalizeNoonLifecyclePayload(payload, context.marketplaceKey);
        });
    }

    /**
     * Poll a single FBPI order and return a lifecycle command.
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../../marketplace-order-ingestion/public/marketplace-order-adapter.port.js').MarketplaceOrderFetchContext} context
     * @param {string} externalEventId
     */
    async fetchOrderLifecycleCommand(runtime, context, externalEventId) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'fetchOrderLifecycleCommand');
            const response = await this.api.getFbpiOrder(runtime, context.externalOrderId);
            return mapNoonFbpiOrderToLifecycleCommand({
                marketplaceKey: context.marketplaceKey,
                orderPayload: response.json,
                externalEventId,
            });
        });
    }

    /**
     * @param {unknown} noonEvent
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime | undefined} runtime
     * @param {string} marketplaceKey
     */
    async normalizeFromNoonEvent(noonEvent, runtime, marketplaceKey) {
        if (noonEvent === null || typeof noonEvent !== 'object') {
            throw new MarketplaceValidationError('Noon event envelope is invalid');
        }
        const eventType = typeof noonEvent.event_type === 'string' ? noonEvent.event_type.trim() : '';
        if (eventType !== NOON_FBPI_ORDER_SYNC_EVENT_TYPE) {
            throw new MarketplaceValidationError('Noon event type is not supported for lifecycle', { eventType });
        }
        const metadata = noonEvent.metadata;
        const eventPayload = noonEvent.payload;
        if (metadata === null || metadata === undefined || typeof metadata !== 'object') {
            throw new MarketplaceValidationError('Noon event metadata is missing');
        }
        if (eventPayload === null || eventPayload === undefined || typeof eventPayload !== 'object') {
            throw new MarketplaceValidationError('Noon event payload is missing');
        }
        const orderNr = readNoonEventOrderNr(eventPayload);
        const externalEventId = buildNoonLifecycleExternalEventId(metadata, orderNr);
        this.assertRuntime(runtime, 'normalizeLifecycleCommand');
        const response = await this.api.getFbpiOrder(runtime, orderNr);
        return mapNoonFbpiOrderToLifecycleCommand({
            marketplaceKey,
            orderPayload: response.json,
            externalEventId,
        });
    }
}
