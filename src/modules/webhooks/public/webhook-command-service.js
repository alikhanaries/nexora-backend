/**
 * @typedef {object} WebhookCommandService
 * Public command port for webhook subscription mutations.
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorId: string,
 *   actorKind: 'user'|'api-key',
 *   actorPermissions: readonly string[],
 *   url: string,
 *   description?: string|null,
 *   eventTypes: readonly string[],
 * }) => Promise<{ subscription: object, secret: string }>} createWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorId: string,
 *   actorKind: 'user'|'api-key',
 *   actorPermissions: readonly string[],
 *   subscriptionId: string,
 *   url?: string,
 *   description?: string|null,
 *   eventTypes?: readonly string[],
 *   status?: 'ACTIVE'|'DISABLED',
 * }) => Promise<{ subscription: object }>} updateWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorId: string,
 *   actorKind: 'user'|'api-key',
 *   actorPermissions: readonly string[],
 *   subscriptionId: string,
 * }) => Promise<{ subscription: object }>} disableWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorId: string,
 *   actorKind: 'user'|'api-key',
 *   actorPermissions: readonly string[],
 *   subscriptionId: string,
 * }) => Promise<{ subscription: object }>} deleteWebhookSubscription
 *
 * @property {(input: {
 *   tenantId: string,
 *   actorId: string,
 *   actorKind: 'user'|'api-key',
 *   actorPermissions: readonly string[],
 *   sessionId: string,
 *   subscriptionId: string,
 * }) => Promise<{ subscription: object, secret: string }>} rotateWebhookSecret
 *
 * @property {(input: {
 *   tenantId: string,
 *   subscriptionId: string,
 *   eventId: string,
 *   eventType: string,
 *   nextAttemptAt?: Date|null,
 * }) => Promise<{ delivery: object }>} createWebhookDelivery
 * Internal delivery persistence for worker dispatch.
 */

export { DefaultWebhookCommandService } from '../application/webhook-command-service.js';
