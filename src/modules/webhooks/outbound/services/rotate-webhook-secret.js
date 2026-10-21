import { auditRequestFields } from '../../../audit/public/index.js';
import { AuthorizationError, NotFoundError, RateLimitError, ValidationError } from '../../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../../shared/auth/rate-limit-policies.js';
import { WebhookSubscriptionStatus } from '../models/webhook-subscription-status.js';
import { rotateWebhookSubscriptionSecret } from '../models/webhook-subscription.js';
import { generateWebhookSecret } from '../models/webhook-secret.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';

/**
 * Factory closing over shared deps for webhook module services.
 */
export function createRotateWebhookSecret(deps) {
    /**
     * Tenant-scoped webhook subscription/delivery command; enforces webhooks.manage where required.
     */
    async function execute(input) {
        requireWebhooksManage(deps.authorization, input.actorPermissions);
        if (input.sessionId === undefined) {
            throw new ValidationError('Step-up authentication is required to rotate webhook secrets');
        }
        const hasStepUp = await deps.stepUpVerifier.hasValidStepUp({
            userId: input.actorId,
            tenantId: input.tenantId,
            sessionId: input.sessionId,
        });
        if (!hasStepUp) {
            throw new AuthorizationError('Recent step-up authentication is required');
        }
        const rateLimit = await deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookSecretRotate,
            subject: `${input.tenantId}:${input.actorId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const plaintextSecret = generateWebhookSecret();
        const secretCiphertext = deps.secretEncryptor.encrypt(plaintextSecret);
        const now = new Date();
        const updated = await deps.database.execute(async (tx) => {
            const existing = await deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (existing === null || existing.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const next = rotateWebhookSubscriptionSecret(existing, secretCiphertext, now);
            await deps.subscriptions.updateSecret(tx, next);
            if (deps.auditRecorder !== undefined) {
                await deps.auditRecorder.record(tx, {
                    tenantId: input.tenantId,
                    actorKind: input.actorKind,
                    actorId: input.actorId,
                    eventType: 'WEBHOOK_SECRET_ROTATED',
                    resourceType: 'webhook_subscription',
                    resourceId: next.id,
                    metadata: {},
                    ...auditRequestFields(),
                });
            }
            return next;
        }, { tenantId: input.tenantId });
        return {
            subscription: toWebhookSubscriptionDto(updated),
            secret: plaintextSecret,
        };
    }
    return { execute };
}
