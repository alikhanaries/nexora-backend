/**
 * Registers a tenant webhook subscription (URL, event types, generated signing secret).
 */
import { randomUUID } from 'node:crypto';
import { auditRequestFields } from '../../../audit/public/index.js';
import { RateLimitError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { createWebhookSubscriptionEntity } from '../models/webhook-subscription.js';
import { generateWebhookSecret } from '../models/webhook-secret.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';
import { validateWebhookEventTypes } from './validate-webhook-event-types.js';
import { validateWebhookUrl } from './validate-webhook-url.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createCreateWebhookSubscription(deps) {
    /**
     * Tenant-scoped webhook subscription/delivery command; enforces webhooks.manage where required.
     */
    async function execute(input) {
        requireWebhooksManage(deps.authorization, input.actorPermissions);
        const rateLimit = await deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookCreate,
            subject: `${input.tenantId}:${input.actorId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const url = await validateWebhookUrl(input.url);
        const eventTypes = validateWebhookEventTypes(input.eventTypes);
        const plaintextSecret = generateWebhookSecret();
        const secretCiphertext = deps.secretEncryptor.encrypt(plaintextSecret);
        const now = new Date();
        const subscription = createWebhookSubscriptionEntity({
            id: randomUUID(),
            tenantId: input.tenantId,
            url,
            description: input.description?.trim() || null,
            secretCiphertext,
            eventTypes,
            createdBy: input.actorId,
            createdAt: now,
        });
        await deps.database.execute(async (tx) => {
            await deps.subscriptions.insert(tx, subscription);
            if (deps.auditRecorder !== undefined) {
                await deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'WEBHOOK_SUBSCRIPTION_CREATED',
                    resourceType: 'webhook_subscription',
                    resourceId: subscription.id,
                    metadata: {
                        url,
                        eventTypes,
                    },
                    ...auditRequestFields(),
                });
            }
        }, { tenantId: input.tenantId });
        return {
            subscription: toWebhookSubscriptionDto(subscription),
            secret: plaintextSecret,
        };
    }
    return { execute };
}
