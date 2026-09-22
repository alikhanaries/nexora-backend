import { auditRequestFields } from '../../audit/public/index.js';
import { AuthorizationError, NotFoundError, RateLimitError, ValidationError } from '../../../shared/errors/index.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { WebhookSubscriptionStatus } from '../domain/webhook-subscription-status.js';
import { generateWebhookSecret } from '../domain/webhook-secret.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';

export class RotateWebhookSecret {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksManage(this.deps.authorization, input.actorPermissions);
        if (input.sessionId === undefined) {
            throw new ValidationError('Step-up authentication is required to rotate webhook secrets');
        }
        const hasStepUp = await this.deps.stepUpVerifier.hasValidStepUp({
            userId: input.actorId,
            tenantId: input.tenantId,
            sessionId: input.sessionId,
        });
        if (!hasStepUp) {
            throw new AuthorizationError('Recent step-up authentication is required');
        }
        const rateLimit = await this.deps.rateLimiter.consume({
            policy: AUTH_RATE_LIMIT_POLICIES.webhookSecretRotate,
            subject: `${input.tenantId}:${input.actorId}`,
        });
        if (!rateLimit.allowed) {
            throw new RateLimitError(rateLimit.retryAfterSeconds);
        }
        const plaintextSecret = generateWebhookSecret();
        const secretCiphertext = this.deps.secretEncryptor.encrypt(plaintextSecret);
        const now = new Date();
        const updated = await this.deps.database.execute(async (tx) => {
            const existing = await this.deps.subscriptions.findById(tx, input.tenantId, input.subscriptionId);
            if (existing === null || existing.status === WebhookSubscriptionStatus.DELETED) {
                throw new NotFoundError('Webhook subscription was not found', { subscriptionId: input.subscriptionId });
            }
            const next = existing.rotateSecret(secretCiphertext, now);
            await this.deps.subscriptions.updateSecret(tx, next);
            if (this.deps.auditRecorder !== undefined) {
                await this.deps.auditRecorder.record(tx, {
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
}
