/**
 * @typedef {object} WebhookQueryService
 * Public read port for webhook subscriptions.
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   subscriptionId: string,
 * }) => Promise<{ subscription: object }>} getWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   includeDeleted?: boolean,
 * }) => Promise<{ items: object[] }>} listWebhookSubscriptions
 */

export { DefaultWebhookQueryService } from '../application/webhook-query-service.js';
