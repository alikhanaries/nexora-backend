import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../../marketplace-order-ingestion/public/normalized-marketplace-lifecycle-target-status.js';

/** @typedef {'Pending' | 'Unshipped' | 'PartiallyShipped' | 'Shipped' | 'Canceled' | 'Unfulfillable' | 'InvoiceUnconfirmed' | 'PendingAvailability'} AmazonOrderStatus */

/**
 * Maps Amazon order status (ORDER_CHANGE summary or Orders API) to generic lifecycle target status.
 * Shipped states map to UNKNOWN because the generic executor does not apply FULFILLED yet.
 *
 * @param {string | null | undefined} orderStatus
 * @returns {typeof NormalizedMarketplaceLifecycleTargetStatus[keyof typeof NormalizedMarketplaceLifecycleTargetStatus]}
 */
export function mapAmazonOrderStatusToLifecycleTarget(orderStatus) {
    const status = typeof orderStatus === 'string' ? orderStatus.trim() : '';
    switch (status) {
        case 'Canceled':
            return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
        case 'Pending':
        case 'Unshipped':
        case 'InvoiceUnconfirmed':
        case 'PendingAvailability':
            return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
        case 'PartiallyShipped':
        case 'Shipped':
        case 'Unfulfillable':
            return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
        case '':
            throw new MarketplaceValidationError('Amazon order status is missing');
        default:
            throw new MarketplaceValidationError('Amazon order status is not supported', { orderStatus: status });
    }
}
