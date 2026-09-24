/**
 * Central catalog of integration events known to Nexora.
 *
 * Phase 6 uses this catalog to decide which events may be delivered externally
 * via webhooks. Catalog metadata is provider-neutral and does not expose domain
 * entities or persistence details.
 */

/** @typedef {'none' | 'low' | 'medium'} PiiClassification */

/**
 * @typedef {object} IntegrationEventCatalogEntry
 * @property {string} type
 * @property {number} version
 * @property {string} description
 * @property {boolean} externallyDeliverable
 * @property {PiiClassification} piiClassification
 * @property {string} aggregateType
 * @property {string} producerModule
 * @property {string[]} payloadFields
 * @property {string} [notes]
 */

/** @type {Record<string, IntegrationEventCatalogEntry>} */
export const INTEGRATION_EVENT_CATALOG = Object.freeze({
    'order.created': {
        type: 'order.created',
        version: 1,
        description: 'An order was created.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'order',
        producerModule: 'orders',
        payloadFields: ['orderId', 'tenantId', 'channelId', 'orderNumber', 'status', 'currency', 'totalMinor'],
        notes: 'Producer omits top-level id/occurredAt; outbox assigns them. tenantId is duplicated in payload.',
    },
    'order.confirmed': {
        type: 'order.confirmed',
        version: 1,
        description: 'An order was confirmed.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'order',
        producerModule: 'orders',
        payloadFields: ['orderId', 'tenantId', 'channelId', 'orderNumber', 'status', 'currency', 'totalMinor'],
        notes: 'Same payload shape as order.created.',
    },
    'order.status_changed': {
        type: 'order.status_changed',
        version: 1,
        description: 'An order status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'order',
        producerModule: 'orders',
        payloadFields: ['orderId', 'tenantId', 'channelId', 'orderNumber', 'status', 'currency', 'totalMinor', 'previousStatus'],
    },
    'order.cancelled': {
        type: 'order.cancelled',
        version: 1,
        description: 'An order was cancelled.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'order',
        producerModule: 'orders',
        payloadFields: ['orderId', 'tenantId', 'channelId', 'orderNumber', 'status', 'currency', 'totalMinor'],
    },
    'shipment.created': {
        type: 'shipment.created',
        version: 1,
        description: 'A shipment was created for an order.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'shipment',
        producerModule: 'shipments',
        payloadFields: ['shipmentId', 'tenantId', 'orderId', 'status', 'carrier', 'service', 'trackingNumber'],
        notes: 'tenantId is duplicated in payload.',
    },
    'shipment.shipped': {
        type: 'shipment.shipped',
        version: 1,
        description: 'A shipment was marked shipped.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'shipment',
        producerModule: 'shipments',
        payloadFields: ['shipmentId', 'tenantId', 'orderId', 'status', 'carrier', 'service', 'trackingNumber'],
    },
    'shipment.delivered': {
        type: 'shipment.delivered',
        version: 1,
        description: 'A shipment was marked delivered.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'shipment',
        producerModule: 'shipments',
        payloadFields: ['shipmentId', 'tenantId', 'orderId', 'status', 'carrier', 'service', 'trackingNumber'],
    },
    'shipment.cancelled': {
        type: 'shipment.cancelled',
        version: 1,
        description: 'A shipment was cancelled.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'shipment',
        producerModule: 'shipments',
        payloadFields: ['shipmentId', 'tenantId', 'orderId', 'status', 'carrier', 'service', 'trackingNumber'],
    },
    'shipment.status_changed': {
        type: 'shipment.status_changed',
        version: 1,
        description: 'A shipment status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'shipment',
        producerModule: 'shipments',
        payloadFields: ['shipmentId', 'tenantId', 'orderId', 'status', 'carrier', 'service', 'trackingNumber', 'previousStatus'],
    },
    'cancellation.created': {
        type: 'cancellation.created',
        version: 1,
        description: 'A cancellation request was created.',
        externallyDeliverable: true,
        piiClassification: 'medium',
        aggregateType: 'cancellation',
        producerModule: 'cancellations',
        payloadFields: ['id', 'tenantId', 'orderId', 'status', 'reason', 'lines'],
        notes: 'Payload uses id (not cancellationId). reason is free-text and may contain user-supplied content.',
    },
    'cancellation.completed': {
        type: 'cancellation.completed',
        version: 1,
        description: 'A cancellation was completed.',
        externallyDeliverable: true,
        piiClassification: 'medium',
        aggregateType: 'cancellation',
        producerModule: 'cancellations',
        payloadFields: ['id', 'tenantId', 'orderId', 'status', 'reason', 'lines'],
        notes: 'Same payload shape as cancellation.created.',
    },
    'return.created': {
        type: 'return.created',
        version: 1,
        description: 'A return request was created.',
        externallyDeliverable: true,
        piiClassification: 'medium',
        aggregateType: 'return',
        producerModule: 'returns',
        payloadFields: ['id', 'tenantId', 'orderId', 'shipmentId', 'status', 'reason', 'lines'],
        notes: 'Payload uses id (not returnId). lines[].reason may contain free-text.',
    },
    'return.status_changed': {
        type: 'return.status_changed',
        version: 1,
        description: 'A return status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'medium',
        aggregateType: 'return',
        producerModule: 'returns',
        payloadFields: ['id', 'tenantId', 'orderId', 'shipmentId', 'status', 'reason', 'lines', 'previousStatus'],
    },
    'product.created': {
        type: 'product.created',
        version: 1,
        description: 'A product was created.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'product',
        producerModule: 'products',
        payloadFields: ['productId', 'merchantSku', 'productType', 'status'],
        notes: 'tenantId is on the integration event envelope, not duplicated in payload.',
    },
    'product.updated': {
        type: 'product.updated',
        version: 1,
        description: 'A product was updated.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'product',
        producerModule: 'products',
        payloadFields: ['productId', 'changes'],
        notes: 'changes contains field-level from/to diffs for externalReference and productType only.',
    },
    'product.status_changed': {
        type: 'product.status_changed',
        version: 1,
        description: 'A product status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'product',
        producerModule: 'products',
        payloadFields: ['productId', 'previousStatus', 'status'],
    },
    'inventory.inventory_changed': {
        type: 'inventory.inventory_changed',
        version: 1,
        description: 'An inventory balance changed.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'inventory_balance',
        producerModule: 'inventory',
        payloadFields: ['productId', 'stockLocationId', 'quantity', 'delta', 'movementType', 'referenceType', 'referenceId', 'balance'],
        notes: 'Emitted for adjust, receive, sale, and return movements. Metadata fields vary by movement.',
    },
    'inventory.inventory_reserved': {
        type: 'inventory.inventory_reserved',
        version: 1,
        description: 'Inventory was reserved.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'inventory_balance',
        producerModule: 'inventory',
        payloadFields: ['productId', 'stockLocationId', 'quantity', 'referenceType', 'referenceId', 'balance'],
    },
    'inventory.inventory_released': {
        type: 'inventory.inventory_released',
        version: 1,
        description: 'A previously reserved inventory quantity was released.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'inventory_balance',
        producerModule: 'inventory',
        payloadFields: ['productId', 'stockLocationId', 'quantity', 'referenceType', 'referenceId', 'balance'],
    },
    'offer.created': {
        type: 'offer.created',
        version: 1,
        description: 'An offer was created.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'offer',
        producerModule: 'offers',
        payloadFields: ['id', 'productId', 'channelId', 'status', 'externalReference', 'priceReference', 'listingStatus'],
        notes: 'tenantId is on the integration event envelope and duplicated in payload.',
    },
    'offer.updated': {
        type: 'offer.updated',
        version: 1,
        description: 'An offer was updated.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'offer',
        producerModule: 'offers',
        payloadFields: ['id', 'productId', 'channelId', 'status', 'externalReference', 'priceReference', 'listingStatus', 'changes'],
    },
    'offer.status_changed': {
        type: 'offer.status_changed',
        version: 1,
        description: 'An offer status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'offer',
        producerModule: 'offers',
        payloadFields: ['id', 'productId', 'channelId', 'status', 'externalReference', 'priceReference', 'listingStatus', 'previousStatus'],
    },
    'channel.created': {
        type: 'channel.created',
        version: 1,
        description: 'A channel was created.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'channel',
        producerModule: 'channels',
        payloadFields: ['id', 'marketplaceId', 'name', 'status', 'externalReference', 'configurationReference', 'defaultStockLocationId'],
    },
    'channel.updated': {
        type: 'channel.updated',
        version: 1,
        description: 'A channel was updated.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'channel',
        producerModule: 'channels',
        payloadFields: ['id', 'marketplaceId', 'name', 'status', 'externalReference', 'configurationReference', 'defaultStockLocationId'],
    },
    'channel.status_changed': {
        type: 'channel.status_changed',
        version: 1,
        description: 'A channel status transition occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'channel',
        producerModule: 'channels',
        payloadFields: ['id', 'marketplaceId', 'name', 'status', 'externalReference', 'configurationReference', 'defaultStockLocationId', 'previousStatus'],
    },
    'price.created': {
        type: 'price.created',
        version: 1,
        description: 'A price was created.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'price',
        producerModule: 'pricing',
        payloadFields: ['id', 'productId', 'channelId', 'currency', 'amountMinor', 'validFrom', 'validTo', 'status'],
    },
    'price.updated': {
        type: 'price.updated',
        version: 1,
        description: 'A price was updated.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'price',
        producerModule: 'pricing',
        payloadFields: ['id', 'productId', 'channelId', 'currency', 'amountMinor', 'validFrom', 'validTo', 'status', 'changes'],
    },
    'price.changed': {
        type: 'price.changed',
        version: 1,
        description: 'An effective price change occurred.',
        externallyDeliverable: true,
        piiClassification: 'low',
        aggregateType: 'price',
        producerModule: 'pricing',
        payloadFields: ['id', 'productId', 'channelId', 'currency', 'amountMinor', 'validFrom', 'validTo', 'status', 'reason'],
        notes: 'reason describes why the effective price changed (e.g. validity window).',
    },
});

/** Cumulative external delivery allowlist (Phase 6 fulfillment + Phase 7.5 + Phase 11 commerce), in stable order. */
export const PHASE_6_EXTERNAL_EVENT_ALLOWLIST = Object.freeze([
    'order.created',
    'order.confirmed',
    'order.status_changed',
    'order.cancelled',
    'shipment.created',
    'shipment.shipped',
    'shipment.delivered',
    'shipment.cancelled',
    'shipment.status_changed',
    'cancellation.created',
    'cancellation.completed',
    'return.created',
    'return.status_changed',
    'product.created',
    'product.updated',
    'product.status_changed',
    'inventory.inventory_changed',
    'inventory.inventory_reserved',
    'inventory.inventory_released',
    'offer.created',
    'offer.updated',
    'offer.status_changed',
    'channel.created',
    'channel.updated',
    'channel.status_changed',
    'price.created',
    'price.updated',
    'price.changed',
]);

/**
 * @param {string} eventType
 * @returns {IntegrationEventCatalogEntry|null}
 */
export function getCatalogEntry(eventType) {
    return INTEGRATION_EVENT_CATALOG[eventType] ?? null;
}

/**
 * @param {string} eventType
 * @returns {boolean}
 */
export function isKnownEventType(eventType) {
    return getCatalogEntry(eventType) !== null;
}

/**
 * @param {string} eventType
 * @returns {boolean}
 */
export function isExternallyDeliverable(eventType) {
    const entry = getCatalogEntry(eventType);
    return entry?.externallyDeliverable === true;
}

/**
 * @returns {IntegrationEventCatalogEntry[]}
 */
export function listCatalogEntries() {
    return Object.values(INTEGRATION_EVENT_CATALOG);
}

/**
 * @returns {string[]}
 */
export function listExternallyDeliverableEventTypes() {
    return PHASE_6_EXTERNAL_EVENT_ALLOWLIST.filter((eventType) => isExternallyDeliverable(eventType));
}

/**
 * @param {string} eventType
 * @param {number} version
 * @returns {boolean}
 */
export function matchesCatalogVersion(eventType, version) {
    const entry = getCatalogEntry(eventType);
    return entry !== null && entry.version === version;
}

/**
 * Returns event types that are not externally deliverable according to the catalog.
 *
 * @param {readonly string[]} eventTypes
 * @returns {string[]}
 */
export function findUndeliverableEventTypes(eventTypes) {
    const unique = [...new Set(eventTypes)];
    return unique.filter((eventType) => !isExternallyDeliverable(eventType));
}
