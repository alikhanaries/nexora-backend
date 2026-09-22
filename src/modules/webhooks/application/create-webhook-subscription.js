import { randomUUID } from 'node:crypto';
import { WebhookSubscription } from '../domain/webhook-subscription.js';
import { generateWebhookSecret } from '../domain/webhook-secret.js';
import { toWebhookSubscriptionDto } from './webhook-subscription-dto.js';
import { requireWebhooksManage } from './webhook-permissions.js';
import { validateWebhookEventTypes } from './validate-webhook-event-types.js';
import { validateWebhookUrl } from './validate-webhook-url.js';

export class CreateWebhookSubscription {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        requireWebhooksManage(this.deps.authorization, input.actorPermissions);
        const url = validateWebhookUrl(input.url);
        const eventTypes = validateWebhookEventTypes(input.eventTypes);
        const plaintextSecret = generateWebhookSecret();
        const secretCiphertext = this.deps.secretEncryptor.encrypt(plaintextSecret);
        const now = new Date();
        const subscription = WebhookSubscription.create({
            id: randomUUID(),
            tenantId: input.tenantId,
            url,
            description: input.description?.trim() || null,
            secretCiphertext,
            eventTypes,
            createdBy: input.actorId,
            createdAt: now,
        });
        await this.deps.database.execute(async (tx) => {
            await this.deps.subscriptions.insert(tx, subscription);
            if (this.deps.auditRecorder !== undefined) {
                await this.deps.auditRecorder.record(tx, {
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
                });
            }
        }, { tenantId: input.tenantId });
        return {
            subscription: toWebhookSubscriptionDto(subscription),
            secret: plaintextSecret,
        };
    }
}
