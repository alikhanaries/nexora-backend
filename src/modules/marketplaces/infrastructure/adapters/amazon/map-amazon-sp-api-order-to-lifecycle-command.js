import { MarketplaceOrderLifecycleOperation } from '../../../../marketplace-order-ingestion/public/marketplace-order-lifecycle-operation.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { mapAmazonOrderStatusToLifecycleTarget } from './amazon-order-status.js';

/**
 * Maps Orders API getOrder payload to a status_sync lifecycle command (polling / manual sync).
 *
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {object} input.orderPayload Orders API getOrder response JSON
 * @param {string} input.externalEventId
 */
export function mapAmazonSpApiOrderToLifecycleCommand(input) {
    const order = input.orderPayload?.payload?.Order ?? input.orderPayload?.Order;
    if (order === null || order === undefined || typeof order !== 'object') {
        throw new MarketplaceValidationError('Amazon getOrder response is missing Order');
    }
    const amazonOrderId = typeof order.AmazonOrderId === 'string' ? order.AmazonOrderId.trim() : '';
    if (amazonOrderId.length === 0) {
        throw new MarketplaceValidationError('Amazon order is missing AmazonOrderId');
    }
    const targetStatus = mapAmazonOrderStatusToLifecycleTarget(order.OrderStatus);
    const purchaseDate = typeof order.PurchaseDate === 'string' ? order.PurchaseDate : undefined;
    return {
        operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
        marketplaceKey: input.marketplaceKey,
        externalOrderId: amazonOrderId,
        externalEventId: input.externalEventId,
        ...(purchaseDate === undefined ? {} : { occurredAt: purchaseDate }),
        targetStatus,
    };
}
