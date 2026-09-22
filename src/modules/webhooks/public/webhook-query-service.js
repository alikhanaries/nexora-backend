/**
 * @typedef {object} WebhookQueryService
 * Public read port for webhook subscriptions and delivery history.
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   actorId?: string,
 *   subscriptionId: string,
 * }) => Promise<{ subscription: object }>} getWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   actorId?: string,
 *   limit?: number,
 *   cursor?: string,
 *   status?: 'ACTIVE'|'DISABLED'|'DELETED',
 *   includeDeleted?: boolean,
 * }) => Promise<{ items: object[], hasMore: boolean, nextCursor: string|null }>} listWebhookSubscriptions
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   actorId?: string,
 *   subscriptionId: string,
 *   limit?: number,
 *   cursor?: string,
 *   status?: string,
 *   eventType?: string,
 * }) => Promise<{ items: object[], hasMore: boolean, nextCursor: string|null }>} listWebhookDeliveries
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorPermissions: readonly string[],
 *   actorId?: string,
 *   subscriptionId: string,
 *   deliveryId: string,
 * }) => Promise<{ delivery: object }>} getWebhookDelivery
 */

export { DefaultWebhookQueryService } from '../application/webhook-query-service.js';
