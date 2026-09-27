import { BaseMarketplaceOrderAdapter } from '../base-marketplace-order-adapter.js';
import { AMAZON_MARKETPLACE_KEY } from './amazon-catalog-adapter.js';
import { AmazonSpApiClient } from './amazon-sp-api-client.js';
import { mapMarketplaceFulfillmentToAmazonConfirmShipment } from './map-marketplace-fulfillment-to-amazon-confirm-shipment.js';

export class AmazonOutboundOrderLifecycleAdapter extends BaseMarketplaceOrderAdapter {
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

    getLifecycleCapabilities() {
        return {
            supportsOutboundCancellation: false,
            supportsOutboundRefund: false,
            supportsOutboundFulfillment: true,
            supportsOutboundReturns: false,
        };
    }

    /**
     * MFN shipment confirmation via Orders API confirmShipment → generic fulfill_order.
     *
     * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceOutboundOrderLifecycleContext} context
     * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
     */
    async createFulfillment(runtime, context, request) {
        return this.runWithResult(async () => {
            this.assertRuntime(runtime, 'createFulfillment');
            const mapped = mapMarketplaceFulfillmentToAmazonConfirmShipment(runtime, request);
            const { packageReferenceId, ...body } = mapped;
            await this.spApi.confirmShipment(runtime, context.externalOrderId, body);
            return {
                outcome: 'fulfilled',
                providerReference: packageReferenceId,
                providerMetadata: {
                    amazonOrderId: context.externalOrderId,
                    packageReferenceId,
                },
            };
        });
    }
}
