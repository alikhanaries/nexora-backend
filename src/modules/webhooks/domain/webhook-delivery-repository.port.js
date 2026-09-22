/** @typedef {import('./webhook-delivery.js').WebhookDelivery} WebhookDelivery */

/**
 * @typedef {object} WebhookDeliveryRepository
 * @property {(queryable: object, delivery: WebhookDelivery) => Promise<void>} insert
 * @property {(queryable: object, tenantId: string, deliveryId: string) => Promise<WebhookDelivery|null>} findById
 * @property {(queryable: object, tenantId: string, subscriptionId: string, eventId: string) => Promise<WebhookDelivery|null>} findBySubscriptionAndEventId
 * @property {(queryable: object, delivery: WebhookDelivery) => Promise<void>} update
 * @property {(queryable: object, tenantId: string, subscriptionId: string, input?: { limit?: number }) => Promise<WebhookDelivery[]>} listBySubscription
 */

export {};
