import { BusinessRuleError } from '../../../../shared/errors/index.js';
import { WebhookSubscriptionStatus } from './webhook-subscription-status.js';

/**
 * @typedef {{
 *   id: string,
 *   tenantId: string,
 *   url: string,
 *   description: string | null,
 *   secretCiphertext: string,
 *   eventTypes: string[],
 *   status: string,
 *   createdBy: string | null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }} WebhookSubscription
 */

/**
 * @param {object} props
 * @returns {WebhookSubscription}
 */
export function createWebhookSubscriptionEntity(props) {
    return {
        id: props.id,
        tenantId: props.tenantId,
        url: props.url,
        description: props.description ?? null,
        secretCiphertext: props.secretCiphertext,
        eventTypes: [...props.eventTypes],
        status: WebhookSubscriptionStatus.ACTIVE,
        createdBy: props.createdBy ?? null,
        createdAt: props.createdAt,
        updatedAt: props.createdAt,
    };
}

/**
 * @param {WebhookSubscription} props
 * @returns {WebhookSubscription}
 */
export function reconstituteWebhookSubscription(props) {
    return {
        ...props,
        eventTypes: [...props.eventTypes],
    };
}

/**
 * @param {WebhookSubscription} subscription
 */
export function isWebhookSubscriptionActive(subscription) {
    return subscription.status === WebhookSubscriptionStatus.ACTIVE;
}

/**
 * @param {WebhookSubscription} subscription
 * @param {object} input
 * @param {Date} at
 * @returns {WebhookSubscription}
 */
export function updateWebhookSubscriptionDetails(subscription, input, at) {
    if (subscription.status === WebhookSubscriptionStatus.DELETED) {
        throw new BusinessRuleError('Deleted webhook subscriptions cannot be updated');
    }
    return {
        id: subscription.id,
        tenantId: subscription.tenantId,
        url: input.url ?? subscription.url,
        description: input.description === undefined ? subscription.description : input.description,
        secretCiphertext: subscription.secretCiphertext,
        eventTypes: input.eventTypes === undefined ? subscription.eventTypes : [...input.eventTypes],
        status: input.status ?? subscription.status,
        createdBy: subscription.createdBy,
        createdAt: subscription.createdAt,
        updatedAt: at,
    };
}

/**
 * @param {WebhookSubscription} subscription
 * @param {Date} at
 * @returns {WebhookSubscription}
 */
export function disableWebhookSubscriptionEntity(subscription, at) {
    if (subscription.status === WebhookSubscriptionStatus.DELETED) {
        throw new BusinessRuleError('Deleted webhook subscriptions cannot be disabled');
    }
    return {
        ...subscription,
        eventTypes: [...subscription.eventTypes],
        status: WebhookSubscriptionStatus.DISABLED,
        updatedAt: at,
    };
}

/**
 * @param {WebhookSubscription} subscription
 * @param {Date} at
 * @returns {WebhookSubscription}
 */
export function markWebhookSubscriptionDeleted(subscription, at) {
    return {
        ...subscription,
        eventTypes: [...subscription.eventTypes],
        status: WebhookSubscriptionStatus.DELETED,
        updatedAt: at,
    };
}

/**
 * @param {WebhookSubscription} subscription
 * @param {string} secretCiphertext
 * @param {Date} at
 * @returns {WebhookSubscription}
 */
export function rotateWebhookSubscriptionSecret(subscription, secretCiphertext, at) {
    if (subscription.status === WebhookSubscriptionStatus.DELETED) {
        throw new BusinessRuleError('Deleted webhook subscriptions cannot rotate secrets');
    }
    return {
        ...subscription,
        eventTypes: [...subscription.eventTypes],
        secretCiphertext,
        updatedAt: at,
    };
}
