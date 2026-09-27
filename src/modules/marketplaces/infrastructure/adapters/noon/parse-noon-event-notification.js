import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';

/** Supported Noon Event Notifications types for order lifecycle (Phase 35). */
export const NOON_FBPI_ORDER_SYNC_EVENT_TYPE = 'FBPI::ORDER_SYNC';

/**
 * @param {string} rawBody
 */
export function parseNoonEventNotification(rawBody) {
    let parsed;
    try {
        parsed = JSON.parse(rawBody);
    }
    catch {
        throw new MarketplaceValidationError('Noon event notification body is not valid JSON');
    }
    if (parsed === null || typeof parsed !== 'object') {
        throw new MarketplaceValidationError('Noon event notification must be a JSON object');
    }
    const eventSchemaVersion = parsed.event_schema_version;
    if (eventSchemaVersion !== 1) {
        throw new MarketplaceValidationError('Noon event_schema_version is not supported', {
            eventSchemaVersion,
        });
    }
    const eventType = typeof parsed.event_type === 'string' ? parsed.event_type.trim() : '';
    if (eventType.length === 0) {
        throw new MarketplaceValidationError('Noon event_type is missing');
    }
    const metadata = parsed.metadata;
    if (metadata === null || metadata === undefined || typeof metadata !== 'object') {
        throw new MarketplaceValidationError('Noon event metadata is missing');
    }
    const payload = parsed.payload;
    if (payload === null || payload === undefined || typeof payload !== 'object') {
        throw new MarketplaceValidationError('Noon event payload is missing');
    }
    return {
        eventType,
        metadata,
        payload,
        envelope: parsed,
    };
}

/**
 * @param {object} payload
 */
export function readNoonEventOrderNr(payload) {
    const orderNr = typeof payload.order_nr === 'string' ? payload.order_nr.trim() : '';
    if (orderNr.length === 0) {
        throw new MarketplaceValidationError('Noon event payload.order_nr is missing');
    }
    return orderNr;
}

/**
 * @param {object} metadata
 * @param {string} orderNr
 */
export function buildNoonLifecycleExternalEventId(metadata, orderNr) {
    const messageId = typeof metadata.message_id === 'string' ? metadata.message_id.trim() : '';
    if (messageId.length > 0) {
        return messageId;
    }
    const publishedAt = typeof metadata.published_at === 'string' ? metadata.published_at.trim() : '';
    return `${publishedAt || 'noon'}:${orderNr}`;
}
