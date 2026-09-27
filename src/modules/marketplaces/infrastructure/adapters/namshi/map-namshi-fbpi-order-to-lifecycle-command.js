import { MarketplaceOrderLifecycleOperation } from '../../../../marketplace-order-ingestion/public/marketplace-order-lifecycle-operation.js';
import { NormalizedMarketplaceLifecycleTargetStatus } from '../../../../marketplace-order-ingestion/public/normalized-marketplace-lifecycle-target-status.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NAMSHI_MARKETPLACE_KEY } from './namshi-catalog-adapter.js';
import {
    NAMSHI_FBPI_EVENT_TYPE_ORDER_SYNC,
    NAMSHI_FBPI_MP_CODE,
    NamshiFbpiMpItemStatus,
} from './namshi-fbpi-constants.js';
import { deriveNamshiFbpiOrderTargetStatus } from './namshi-fbpi-order-status.js';
import { parseNamshiFbpiWebhookEvent } from './parse-namshi-fbpi-webhook-event.js';

/**
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {object} input.orderPayload GetFbpiOrder JSON body
 * @param {string} input.externalEventId
 */
export function mapNamshiFbpiOrderToLifecycleCommand(input) {
    const order = input.orderPayload;
    if (order === null || typeof order !== 'object') {
        throw new MarketplaceValidationError('Namshi FBPI order payload is invalid');
    }
    const fbpiOrderNr = typeof order.fbpi_order_nr === 'string' ? order.fbpi_order_nr.trim() : '';
    if (fbpiOrderNr.length === 0) {
        throw new MarketplaceValidationError('Namshi FBPI order is missing fbpi_order_nr');
    }
    const mpCode = typeof order.mp_code === 'string' ? order.mp_code.trim().toLowerCase() : '';
    if (mpCode !== NAMSHI_FBPI_MP_CODE) {
        throw new MarketplaceValidationError('FBPI order mp_code is not namshi', {
            mpCode: order.mp_code ?? null,
        });
    }
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
        throw new MarketplaceValidationError('Namshi FBPI order has no items');
    }
    const occurredAt = typeof order.order_created_at === 'string' ? order.order_created_at : undefined;
    const cancelLines = mapCancelledItemLines(items);
    if (cancelLines.length > 0 && cancelLines.length < items.length) {
        return {
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            marketplaceKey: input.marketplaceKey,
            externalOrderId: fbpiOrderNr,
            externalEventId: input.externalEventId,
            ...(occurredAt === undefined ? {} : { occurredAt }),
            reason: 'Namshi FBPI item cancellation',
            lines: cancelLines,
        };
    }
    const targetStatus = deriveNamshiFbpiOrderTargetStatus(items);
    if (targetStatus === NormalizedMarketplaceLifecycleTargetStatus.CANCELLED) {
        return {
            operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
            marketplaceKey: input.marketplaceKey,
            externalOrderId: fbpiOrderNr,
            externalEventId: input.externalEventId,
            ...(occurredAt === undefined ? {} : { occurredAt }),
            targetStatus,
        };
    }
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
function mapCancelledItemLines(items) {
    /** @type {{ merchantSku?: string, externalLineId?: string, quantity: number }[]} */
    const lines = [];
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        if (item.mp_status !== NamshiFbpiMpItemStatus.CANCELLED) {
            continue;
        }
        const partnerSku = typeof item.partner_sku === 'string' ? item.partner_sku.trim() : '';
        const mpItemNr = typeof item.mp_item_nr === 'string' ? item.mp_item_nr.trim() : '';
        lines.push({
            ...(partnerSku.length > 0 ? { merchantSku: partnerSku } : {}),
            ...(mpItemNr.length > 0 ? { externalLineId: mpItemNr } : {}),
            quantity: 1,
        });
    }
    return lines;
}

/**
 * @param {object} input
 * @param {string | null | undefined} input.messageId
 * @param {string} input.orderNr
 * @param {string | null | undefined} input.publishedAt
 * @param {string | null | undefined} input.eventType
 */
export function buildNamshiFbpiLifecycleEventId(input) {
    const messageId = typeof input.messageId === 'string' ? input.messageId.trim() : '';
    if (messageId.length > 0) {
        return messageId;
    }
    const orderNr = input.orderNr.trim();
    const publishedAt = typeof input.publishedAt === 'string' ? input.publishedAt : 'unknown';
    const eventType = typeof input.eventType === 'string' ? input.eventType : NAMSHI_FBPI_EVENT_TYPE_ORDER_SYNC;
    return `${eventType}:${orderNr}:${publishedAt}`;
}

/**
 * @param {unknown} payload
 * @param {string} [marketplaceKey]
 */
export function normalizeNamshiLifecyclePayload(payload, marketplaceKey = NAMSHI_MARKETPLACE_KEY) {
    if (payload === null || typeof payload !== 'object') {
        throw new MarketplaceValidationError('Namshi lifecycle payload must be an object');
    }
    if ('source' in payload && payload.source === 'fbpi_order_sync' && 'event' in payload) {
        const parsed = parseNamshiFbpiWebhookEvent(payload.event);
        const externalEventId = buildNamshiFbpiLifecycleEventId({
            messageId: parsed.messageId,
            orderNr: parsed.orderNr,
            publishedAt: parsed.publishedAt,
            eventType: parsed.eventType,
        });
        if ('orderPayload' in payload && payload.orderPayload !== undefined) {
            return mapNamshiFbpiOrderToLifecycleCommand({
                marketplaceKey,
                orderPayload: payload.orderPayload,
                externalEventId,
            });
        }
        throw new MarketplaceValidationError('Namshi FBPI webhook lifecycle payload requires fetched orderPayload');
    }
    if ('orderPayload' in payload && payload.orderPayload !== undefined) {
        const externalEventId = typeof payload.externalEventId === 'string' ? payload.externalEventId.trim() : '';
        if (externalEventId.length === 0) {
            throw new MarketplaceValidationError('externalEventId is required when orderPayload is provided');
        }
        return mapNamshiFbpiOrderToLifecycleCommand({
            marketplaceKey,
            orderPayload: payload.orderPayload,
            externalEventId,
        });
    }
    throw new MarketplaceValidationError('Namshi lifecycle payload is not recognized');
}
