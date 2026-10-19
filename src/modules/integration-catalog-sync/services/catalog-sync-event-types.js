/** Integration event types that may enqueue channel catalog sync work (ADR-028). */
export const CATALOG_SYNC_INTEGRATION_EVENT_TYPES = Object.freeze([
    'product.created',
    'product.updated',
    'product.status_changed',
    'offer.created',
    'offer.updated',
    'offer.status_changed',
    'price.created',
    'price.updated',
    'price.changed',
    'inventory.inventory_changed',
    'inventory.inventory_reserved',
    'inventory.inventory_released',
    'channel.updated',
]);

const CATALOG_SYNC_EVENT_TYPE_SET = new Set(CATALOG_SYNC_INTEGRATION_EVENT_TYPES);

/**
 * @param {string} eventType
 */
export function isCatalogSyncIntegrationEventType(eventType) {
    return CATALOG_SYNC_EVENT_TYPE_SET.has(eventType);
}
