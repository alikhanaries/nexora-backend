import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../../marketplace-order-ingestion/public/normalized-marketplace-lifecycle-target-status.js';
import {
    NamshiFbpiIntegrationItemStatus,
    NamshiFbpiMpItemStatus,
} from './namshi-fbpi-constants.js';

/**
 * @param {string | undefined | null} mpStatus
 */
export function mapNamshiFbpiMpItemStatusToLifecycleTarget(mpStatus) {
    switch (mpStatus) {
        case NamshiFbpiMpItemStatus.CONFIRMED:
            return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
        case NamshiFbpiMpItemStatus.CANCELLED:
            return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
        case NamshiFbpiMpItemStatus.UNSPECIFIED:
        default:
            return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
}

/**
 * Derives order-level target status from FBPI item rows (conservative aggregation).
 *
 * @param {object[]} items
 */
export function deriveNamshiFbpiOrderTargetStatus(items) {
    if (items.length === 0) {
        return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
    const mpTargets = items.map((item) => mapNamshiFbpiMpItemStatusToLifecycleTarget(item?.mp_status));
    if (mpTargets.every((status) => status === NormalizedMarketplaceLifecycleTargetStatus.CANCELLED)) {
        return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
    }
    const allShipped = items.every((item) => item?.integration_status === NamshiFbpiIntegrationItemStatus.SHIPPED);
    if (allShipped) {
        return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
    const allConfirmed = mpTargets.every((status) => status === NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED)
        || items.every((item) => item?.integration_status === NamshiFbpiIntegrationItemStatus.ACKNOWLEDGED
            || item?.integration_status === NamshiFbpiIntegrationItemStatus.OUT_OF_STOCK);
    if (allConfirmed) {
        return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
    }
    return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
}
