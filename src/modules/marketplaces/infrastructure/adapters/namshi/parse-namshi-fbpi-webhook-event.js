import { MarketplaceValidationError } from '../../../domain/marketplace-errors.js';
import { NAMSHI_FBPI_EVENT_TYPE_ORDER_SYNC } from './namshi-fbpi-constants.js';

/**
 * @param {unknown} event
 */
export function parseNamshiFbpiWebhookEvent(event) {
    if (event === null || typeof event !== 'object') {
        throw new MarketplaceValidationError('Namshi FBPI webhook event is invalid');
    }
    const eventType = typeof event.event_type === 'string' ? event.event_type : '';
    if (eventType !== NAMSHI_FBPI_EVENT_TYPE_ORDER_SYNC) {
        throw new MarketplaceValidationError('Namshi FBPI webhook event_type is not supported', { eventType });
    }
    const schemaVersion = event.event_schema_version;
    if (schemaVersion !== 1 && schemaVersion !== '1') {
        throw new MarketplaceValidationError('Namshi FBPI webhook event_schema_version is not supported', {
            eventSchemaVersion: schemaVersion,
        });
    }
    const orderNr = typeof event.payload?.order_nr === 'string' ? event.payload.order_nr.trim() : '';
    if (orderNr.length === 0) {
        throw new MarketplaceValidationError('Namshi FBPI webhook payload.order_nr is missing');
    }
    const metadata = event.metadata ?? {};
    const messageId = typeof metadata.message_id === 'string' ? metadata.message_id : null;
    const publishedAt = typeof metadata.published_at === 'string' ? metadata.published_at : null;
    return {
        eventType,
        orderNr,
        messageId,
        publishedAt,
    };
}
