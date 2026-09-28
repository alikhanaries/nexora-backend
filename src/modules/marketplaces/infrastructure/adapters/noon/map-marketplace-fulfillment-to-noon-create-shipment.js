import { createHash } from 'node:crypto';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { readNoonWarehouseCode } from './noon-config.js';

/**
 * Maps generic outbound fulfillment to FBPI CreateShipment body.
 *
 * @see https://noon-docs.noonpartners.dev/docs/fbpi/setup/order-flow
 *
 * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
 * @param {string} fbpiOrderNr
 * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
 */
export function mapMarketplaceFulfillmentToNoonCreateShipment(runtime, fbpiOrderNr, request) {
    const orderNr = fbpiOrderNr.trim();
    if (orderNr.length === 0) {
        throw new MarketplaceValidationError('Noon CreateShipment requires fbpi_order_nr');
    }
    const lines = request.lines ?? [];
    if (lines.length === 0) {
        throw new MarketplaceValidationError('Noon CreateShipment requires at least one line');
    }
    const awbNr = typeof request.trackingNumber === 'string' ? request.trackingNumber.trim() : '';
    if (awbNr.length === 0) {
        throw new MarketplaceValidationError('Noon CreateShipment requires trackingNumber (awb_nr)');
    }
    const courier = typeof request.carrier === 'string' ? request.carrier.trim() : '';
    if (courier.length === 0) {
        throw new MarketplaceValidationError('Noon CreateShipment requires carrier');
    }
    const warehouseCode = readNoonWarehouseCode(runtime.configuration ?? {});
    /** @type {Array<{ mp_item_nr: string }>} */
    const items = [];
    for (const line of lines) {
        const mpItemNr = typeof line.externalLineItemId === 'string' ? line.externalLineItemId.trim() : '';
        if (mpItemNr.length === 0) {
            throw new MarketplaceValidationError('Noon fulfillment lines require externalLineItemId (mp_item_nr)');
        }
        const quantity = Number(line.quantity);
        if (!Number.isFinite(quantity) || quantity !== 1) {
            throw new MarketplaceValidationError(
                'Noon CreateShipment supports quantity 1 per mp_item_nr line; ship partial orders by listing each mp_item_nr separately',
                { mpItemNr, quantity: line.quantity },
            );
        }
        items.push({ mp_item_nr: mpItemNr });
    }
    const integrationShipmentNr = buildIntegrationShipmentNr(items, awbNr);
    return {
        body: {
            warehouse_code: warehouseCode,
            integration_shipment_nr: integrationShipmentNr,
            fbpi_order_nr: orderNr,
            awbs: [{ courier, awb_nr: awbNr }],
            items,
        },
        integrationShipmentNr,
    };
}

/**
 * @param {Array<{ mp_item_nr: string }>} items
 * @param {string} awbNr
 */
function buildIntegrationShipmentNr(items, awbNr) {
    const fingerprint = items
        .map((item) => item.mp_item_nr)
        .sort()
        .join('|');
    const hash = createHash('sha256').update(`${fingerprint}|${awbNr}`).digest('hex');
    return `nexora-${hash.slice(0, 20)}`;
}
