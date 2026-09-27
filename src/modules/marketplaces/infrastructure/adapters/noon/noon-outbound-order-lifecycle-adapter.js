import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { NOON_MARKETPLACE_KEY } from './noon-catalog-adapter.js';
import { NoonApiClient } from './noon-api-client.js';
import { mapMarketplaceFulfillmentToNoonCreateShipment } from './map-marketplace-fulfillment-to-noon-create-shipment.js';

export class NoonOutboundOrderLifecycleAdapter extends BaseMarketplaceOrderAdapter {
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

    getLifecycleCapabilities() {
        return {
            supportsOutboundCancellation: false,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        };
    }

    /**
     * FBPI CreateShipment → generic fulfill_order (seller registers AWB + items with noon).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
     */
    async createFulfillment(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'createFulfillment');
            const mapped = mapMarketplaceFulfillmentToNoonCreateShipment(
                runtime,
                context.externalOrderId,
                request,
            );
            await this.api.createFbpiShipment(runtime, mapped.body);
            return {
                outcome: 'fulfilled',
                providerReference: mapped.integrationShipmentNr,
                providerMetadata: {
                    fbpiOrderNr: context.externalOrderId,
                    integrationShipmentNr: mapped.integrationShipmentNr,
                },
            };
        });
    }
}
