/** @typedef {import('./webhook-subscription.js').WebhookSubscription} WebhookSubscription */

/**
 * @typedef {object} WebhookSubscriptionRepository
 * @property {(queryable: object, subscription: WebhookSubscription) => Promise<void>} insert
 * @property {(queryable: object, tenantId: string, subscriptionId: string) => Promise<WebhookSubscription|null>} findById
 * @property {(queryable: object, tenantId: string, input?: { statuses?: string[] }) => Promise<WebhookSubscription[]>} list
 * @property {(queryable: object, subscription: WebhookSubscription) => Promise<void>} update
 */

export {};
