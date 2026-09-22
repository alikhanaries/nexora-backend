import { OrderStatus } from '../domain/order-status.js';
import { isEquivalentChannelOrderRequest } from './channel-order-request-equivalence.js';

/**
 * @param {object} existingOrder
 * @param {object[]} existingLines
 * @param {object|null} existingCustomer
 * @param {object|null} existingShipment
 * @param {object} input
 * @param {object[]} resolvedLines
 */
export function isEquivalentChannelFulfilledOrderRequest(
    existingOrder,
    existingLines,
    existingCustomer,
    existingShipment,
    input,
    resolvedLines,
) {
    if (existingOrder.status === OrderStatus.NEW) {
        return false;
    }
    if (!isEquivalentChannelOrderRequest(existingOrder, existingLines, existingCustomer, input, resolvedLines)) {
        return false;
    }
    const requestedShipment = input.shipment ?? {};
    const requestedExternalReference = normalizeOptionalText(requestedShipment.externalReference);
    const requestedCarrier = normalizeOptionalText(requestedShipment.carrier);
    const requestedTrackingNumber = normalizeOptionalText(requestedShipment.trackingNumber);
    if (existingShipment === null) {
        return requestedExternalReference === null
            && requestedCarrier === null
            && requestedTrackingNumber === null;
    }
    return normalizeOptionalText(existingShipment.externalReference) === requestedExternalReference
        && normalizeOptionalText(existingShipment.carrier) === requestedCarrier
        && normalizeOptionalText(existingShipment.trackingNumber) === requestedTrackingNumber;
}

/**
 * @param {string|null|undefined} value
 */
function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
