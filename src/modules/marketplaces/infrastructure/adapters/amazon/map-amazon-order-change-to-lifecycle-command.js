import { MarketplaceOrderLifecycleOperation } from '../../../../marketplace-order-ingestion/public/marketplace-order-lifecycle-operation.js';
import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { AMAZON_MARKETPLACE_KEY } from './amazon-catalog-adapter.js';
import { mapAmazonOrderStatusToLifecycleTarget } from './amazon-order-status.js';

/**
 * @param {object} input
 * @param {string} input.marketplaceKey
 * @param {object} input.notification SP-API ORDER_CHANGE root (NotificationType + Payload + metadata)
 */
export function mapAmazonOrderChangeToLifecycleCommand(input) {
    const root = input.notification;
    if (root === null || typeof root !== 'object') {
        throw new MarketplaceValidationError('Amazon ORDER_CHANGE notification is invalid');
    }
    if (root.NotificationType !== 'ORDER_CHANGE') {
        throw new MarketplaceValidationError('Amazon notification type is not ORDER_CHANGE', {
            notificationType: root.NotificationType,
        });
    }
    const change = root.Payload?.OrderChangeNotification;
    if (change === null || change === undefined || typeof change !== 'object') {
        throw new MarketplaceValidationError('Amazon ORDER_CHANGE payload is missing OrderChangeNotification');
    }
    const amazonOrderId = typeof change.AmazonOrderId === 'string' ? change.AmazonOrderId.trim() : '';
    if (amazonOrderId.length === 0) {
        throw new MarketplaceValidationError('Amazon ORDER_CHANGE is missing AmazonOrderId');
    }
    const metadata = root.NotificationMetadata ?? {};
    const notificationId = typeof metadata.NotificationId === 'string' ? metadata.NotificationId : null;
    const orderChangeType = typeof change.OrderChangeType === 'string' ? change.OrderChangeType : 'OrderStatusChange';
    const summary = change.Summary ?? {};
    const orderStatus = summary.OrderStatus;
    const eventTime = typeof root.EventTime === 'string'
        ? root.EventTime
        : (typeof change.OrderChangeTrigger?.TimeOfOrderChange === 'string'
            ? change.OrderChangeTrigger.TimeOfOrderChange
            : undefined);
    const externalEventId = buildAmazonLifecycleEventId({
        notificationId,
        amazonOrderId,
        orderChangeType,
        orderStatus,
        messageId: input.snsMessageId ?? null,
    });
    if (orderChangeType === 'BuyerRequestedChange' || hasBuyerRequestedCancel(summary)) {
        const lines = mapCancelLines(summary.OrderItems);
        return {
            operation: MarketplaceOrderLifecycleOperation.CANCEL_ORDER,
            marketplaceKey: input.marketplaceKey,
            externalOrderId: amazonOrderId,
            externalEventId,
            ...(eventTime === undefined ? {} : { occurredAt: eventTime }),
            reason: 'Buyer requested cancellation on Amazon',
            ...(lines.length > 0 ? { lines } : {}),
        };
    }
    const targetStatus = mapAmazonOrderStatusToLifecycleTarget(orderStatus);
    return {
        operation: MarketplaceOrderLifecycleOperation.STATUS_SYNC,
        marketplaceKey: input.marketplaceKey,
        externalOrderId: amazonOrderId,
        externalEventId,
        ...(eventTime === undefined ? {} : { occurredAt: eventTime }),
        targetStatus,
    };
}

/**
 * @param {object} input
 * @param {string | null} input.notificationId
 * @param {string} input.amazonOrderId
 * @param {string} input.orderChangeType
 * @param {string | undefined} input.orderStatus
 * @param {string | null} input.messageId
 */
function buildAmazonLifecycleEventId(input) {
    if (input.notificationId !== null && input.notificationId.trim().length > 0) {
        return input.notificationId.trim();
    }
    const statusPart = typeof input.orderStatus === 'string' ? input.orderStatus : 'unknown';
    const snsPart = input.messageId ?? 'nosns';
    return `${snsPart}:${input.amazonOrderId}:${input.orderChangeType}:${statusPart}`;
}

/**
 * @param {unknown} summary
 */
function hasBuyerRequestedCancel(summary) {
    if (summary === null || typeof summary !== 'object') {
        return false;
    }
    const items = summary.OrderItems;
    if (!Array.isArray(items)) {
        return false;
    }
    return items.some((item) => item !== null && typeof item === 'object' && item.IsBuyerRequestedCancel === true);
}

/**
 * @param {unknown} orderItems
 */
function mapCancelLines(orderItems) {
    if (!Array.isArray(orderItems)) {
        return [];
    }
    /** @type {{ merchantSku?: string, externalLineId?: string, quantity: number }[]} */
    const lines = [];
    for (const item of orderItems) {
        if (item === null || typeof item !== 'object') {
            continue;
        }
        const sku = typeof item.SellerSKU === 'string' ? item.SellerSKU.trim() : '';
        const orderItemId = typeof item.OrderItemId === 'string' ? item.OrderItemId.trim() : '';
        const quantity = Number(item.Quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            continue;
        }
        lines.push({
            ...(sku.length > 0 ? { merchantSku: sku } : {}),
            ...(orderItemId.length > 0 ? { externalLineId: orderItemId } : {}),
            quantity,
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
export function normalizeAmazonLifecyclePayload(payload, marketplaceKey = AMAZON_MARKETPLACE_KEY) {
    if (payload === null || typeof payload !== 'object') {
        throw new MarketplaceValidationError('Amazon lifecycle payload must be an object');
    }
    if ('notification' in payload && payload.notification !== undefined) {
        return mapAmazonOrderChangeToLifecycleCommand({
            marketplaceKey,
            notification: payload.notification,
            snsMessageId: typeof payload.snsMessageId === 'string' ? payload.snsMessageId : null,
        });
    }
    if ('NotificationType' in payload) {
        return mapAmazonOrderChangeToLifecycleCommand({
            marketplaceKey,
            notification: payload,
            snsMessageId: null,
        });
    }
    throw new MarketplaceValidationError('Amazon lifecycle payload is not recognized');
}
