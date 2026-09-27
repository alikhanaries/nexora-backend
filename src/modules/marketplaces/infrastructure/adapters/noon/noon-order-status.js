import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../../marketplace-order-ingestion/public/normalized-marketplace-lifecycle-target-status.js';

/** @typedef {'MP_ITEM_STATUS_CONFIRMED' | 'MP_ITEM_STATUS_CANCELLED' | 'MP_ITEM_STATUS_UNSPECIFIED'} NoonMpItemStatus */
/** @typedef {'INTEGRATION_ITEM_STATUS_ACKNOWLEDGED' | 'INTEGRATION_ITEM_STATUS_OUT_OF_STOCK' | 'INTEGRATION_ITEM_STATUS_SHIPPED' | 'INTEGRATION_ITEM_STATUS_UNSPECIFIED'} NoonIntegrationItemStatus */

/**
 * Maps a single Noon FBPI item mp_status to a generic lifecycle target hint.
 *
 * @param {string | null | undefined} mpStatus
 */
export function mapNoonMpItemStatusToLifecycleTarget(mpStatus) {
    const status = typeof mpStatus === 'string' ? mpStatus.trim() : '';
    switch (status) {
        case 'MP_ITEM_STATUS_CANCELLED':
            return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
        case 'MP_ITEM_STATUS_CONFIRMED':
            return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
        case 'MP_ITEM_STATUS_UNSPECIFIED':
            return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
        case '':
            throw new MarketplaceValidationError('Noon item mp_status is missing');
        default:
            throw new MarketplaceValidationError('Noon item mp_status is not supported', { mpStatus: status });
    }
}

/**
 * Derives an order-level target status from FBPI order line items.
 *
 * @param {unknown[]} items
 */
export function deriveNoonOrderLifecycleTargetFromItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new MarketplaceValidationError('Noon FBPI order items are missing');
    }
    /** @type {typeof NormalizedMarketplaceLifecycleTargetStatus[keyof typeof NormalizedMarketplaceLifecycleTargetStatus][]} */
    const targets = [];
    let hasShippedIntegration = false;
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        const integrationStatus = typeof item.integration_status === 'string' ? item.integration_status : '';
        if (integrationStatus === 'INTEGRATION_ITEM_STATUS_SHIPPED') {
            hasShippedIntegration = true;
        }
        targets.push(mapNoonMpItemStatusToLifecycleTarget(
            typeof item.mp_status === 'string' ? item.mp_status : undefined,
        ));
    }
    if (targets.length === 0) {
        throw new MarketplaceValidationError('Noon FBPI order items are invalid');
    }
    if (hasShippedIntegration) {
        return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
    if (targets.every((t) => t === NormalizedMarketplaceLifecycleTargetStatus.CANCELLED)) {
        return NormalizedMarketplaceLifecycleTargetStatus.CANCELLED;
    }
    if (targets.every((t) => t === NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED)) {
        return NormalizedMarketplaceLifecycleTargetStatus.CONFIRMED;
    }
    if (targets.some((t) => t === NormalizedMarketplaceLifecycleTargetStatus.CANCELLED)) {
        return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
    }
    return NormalizedMarketplaceLifecycleTargetStatus.UNKNOWN;
}

/**
 * @param {unknown[]} items
 */
export function noonOrderItemsAreFullyCancelled(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return false;
    }
    return items.every((item) => item !== null
        && typeof item === 'object'
        && item.mp_status === 'MP_ITEM_STATUS_CANCELLED');
}
