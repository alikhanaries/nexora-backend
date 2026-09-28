import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { NAMSHI_MARKETPLACE_KEY } from './namshi-catalog-adapter.js';
import { NamshiApiClient } from './namshi-api-client.js';
import { mapMarketplaceFulfillmentToNamshiCreateShipment } from './map-marketplace-fulfillment-to-namshi-create-shipment.js';

export class NamshiOutboundOrderLifecycleAdapter extends BaseMarketplaceOrderAdapter {
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

    getLifecycleCapabilities() {
        return {
            supportsOutboundCancellation: false,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        };
    }

    /**
     * FBPI CreateShipment → generic fulfill_order (Namshi orders on Partners gateway).
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
     */
    async createFulfillment(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'createFulfillment');
            const mapped = mapMarketplaceFulfillmentToNamshiCreateShipment(
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
