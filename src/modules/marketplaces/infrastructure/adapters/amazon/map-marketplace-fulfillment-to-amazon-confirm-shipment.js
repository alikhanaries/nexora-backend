import { createHash } from 'node:crypto';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { readAmazonMarketplaceId } from './amazon-config.js';

/**
 * Maps generic outbound fulfillment to SP-API confirmShipment body (MFN).
 *
 * @param {import('../../../../channel-catalog-sync/public/marketplace-adapter-runtime.port.js').MarketplaceAdapterRuntime} runtime
 * @param {import('../../../public/marketplace-outbound-order-lifecycle.port.js').MarketplaceCreateFulfillmentRequest} request
 * @param {string} [shipDateIso]
 */
export function mapMarketplaceFulfillmentToAmazonConfirmShipment(runtime, request, shipDateIso) {
    const lines = request.lines ?? [];
    if (lines.length === 0) {
        throw new MarketplaceValidationError('Amazon fulfillment requires at least one line');
    }
    const trackingNumber = typeof request.trackingNumber === 'string' ? request.trackingNumber.trim() : '';
    if (trackingNumber.length === 0) {
        throw new MarketplaceValidationError('Amazon confirmShipment requires trackingNumber');
    }
    const carrierCode = typeof request.carrier === 'string' ? request.carrier.trim() : '';
    if (carrierCode.length === 0) {
        throw new MarketplaceValidationError('Amazon confirmShipment requires carrier (carrierCode)');
    }
    const marketplaceId = readAmazonMarketplaceId(runtime.configuration ?? {});
    /** @type {Array<{ orderItemId: string, quantity: number }>} */
    const orderItems = [];
    for (const line of lines) {
        const orderItemId = typeof line.externalLineItemId === 'string' ? line.externalLineItemId.trim() : '';
        if (orderItemId.length === 0) {
            throw new MarketplaceValidationError('Amazon fulfillment lines require externalLineItemId (OrderItemId)');
        }
        const quantity = Number(line.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new MarketplaceValidationError('Amazon fulfillment line quantity must be positive', { orderItemId });
        }
        orderItems.push({ orderItemId, quantity });
    }
    const packageReferenceId = buildPackageReferenceId(orderItems, trackingNumber);
    const shipDate = shipDateIso ?? new Date().toISOString();
    /** @type {Record<string, unknown>} */
    const packageDetail = {
        packageReferenceId,
        carrierCode,
        trackingNumber,
        shipDate,
        orderItems,
    };
    if (carrierCode.toLowerCase() === 'others') {
        throw new MarketplaceValidationError(
            'Amazon carrierCode "Others" requires carrierName; use a standard carrier code or extend connection configuration',
        );
    }
    const shipFromSupplySourceId = readOptionalShipFromSupplySourceId(runtime.configuration ?? {});
    if (shipFromSupplySourceId !== null) {
        packageDetail.shipFromSupplySourceId = shipFromSupplySourceId;
    }
    return {
        marketplaceId,
        codCollectionMethod: '',
        packageDetail,
        packageReferenceId,
    };
}

/**
 * @param {Array<{ orderItemId: string, quantity: number }>} orderItems
 * @param {string} trackingNumber
 */
function buildPackageReferenceId(orderItems, trackingNumber) {
    const fingerprint = orderItems
        .slice()
        .sort((a, b) => a.orderItemId.localeCompare(b.orderItemId))
        .map((item) => `${item.orderItemId}:${item.quantity}`)
        .join('|');
    const hash = createHash('sha256').update(`${fingerprint}|${trackingNumber}`).digest('hex');
    return hash.slice(0, 16);
}

/**
 * @param {Record<string, unknown>} configuration
 */
function readOptionalShipFromSupplySourceId(configuration) {
    const value = configuration.shipFromSupplySourceId;
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
