import { MarketplaceOrderLifecycleOperation } from '../../../../marketplace-order-ingestion/public/marketplace-order-lifecycle-operation.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NOON_MARKETPLACE_KEY } from './noon-catalog-adapter.js';
import {
    deriveNoonOrderLifecycleTargetFromItems,
    noonOrderItemsAreFullyCancelled,
} from './noon-order-status.js';

/**
 * Maps GetFbpiOrder response JSON to a normalized lifecycle command.
 *
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {object} input.orderPayload GetFbpiOrder response body
 * @param {string} input.externalEventId
 */
export function mapNoonFbpiOrderToLifecycleCommand(input) {
    const order = input.orderPayload;
    if (order === null || order === undefined || typeof order !== 'object') {
        throw new MarketplaceValidationError('Noon GetFbpiOrder response is invalid');
    }
    const fbpiOrderNr = typeof order.fbpi_order_nr === 'string' ? order.fbpi_order_nr.trim() : '';
    if (fbpiOrderNr.length === 0) {
        throw new MarketplaceValidationError('Noon FBPI order is missing fbpi_order_nr');
    }
    const items = Array.isArray(order.items) ? order.items : [];
    const occurredAt = typeof order.order_created_at === 'string' ? order.order_created_at : undefined;
    if (noonOrderItemsAreFullyCancelled(items)) {
        return {
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            marketplaceKey: input.marketplaceKey,
            externalOrderId: fbpiOrderNr,
            externalEventId: input.externalEventId,
            ...(occurredAt === undefined ? {} : { occurredAt }),
            reason: 'All Noon FBPI line items are cancelled',
            lines: mapNoonCancelLines(items),
        };
    }
    const targetStatus = deriveNoonOrderLifecycleTargetFromItems(items);
    return {
        operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
        marketplaceKey: input.marketplaceKey,
        externalOrderId: fbpiOrderNr,
        externalEventId: input.externalEventId,
        ...(occurredAt === undefined ? {} : { occurredAt }),
        targetStatus,
    };
}

/**
 * @param {unknown[]} items
 */
function mapNoonCancelLines(items) {
    /** @type {{ merchantSku?: string, externalLineId?: string, quantity: number }[]} */
    const lines = [];
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        const partnerSku = typeof item.partner_sku === 'string' ? item.partner_sku.trim() : '';
        const mpItemNr = typeof item.mp_item_nr === 'string' ? item.mp_item_nr.trim() : '';
        lines.push({
            quantity: 1,
            ...(partnerSku.length > 0 ? { merchantSku: partnerSku } : {}),
            ...(mpItemNr.length > 0 ? { externalLineId: mpItemNr } : {}),
        });
    }
    return lines;
}

/**
 * Normalizes a lifecycle payload stored on webhook events.
 *
 * @param {unknown} payload
 * @param {string} marketplaceKey
 */
export function normalizeNoonLifecyclePayload(payload, marketplaceKey = NOON_MARKETPLACE_KEY) {
    if (payload === null || typeof payload !== 'object') {
        throw new MarketplaceValidationError('Noon lifecycle payload must be an object');
    }
    if ('orderPayload' in payload && payload.orderPayload !== undefined) {
        if (typeof payload.externalEventId !== 'string' || payload.externalEventId.trim().length === 0) {
            throw new MarketplaceValidationError('externalEventId is required for Noon orderPayload lifecycle sync');
        }
        return mapNoonFbpiOrderToLifecycleCommand({
            marketplaceKey,
            orderPayload: payload.orderPayload,
            externalEventId: payload.externalEventId.trim(),
        });
    }
    throw new MarketplaceValidationError('Noon lifecycle payload is not recognized');
}
