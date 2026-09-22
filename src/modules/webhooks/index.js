import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { DefaultWebhookCommandService } from './application/webhook-command-service.js';
import { DefaultWebhookQueryService } from './application/webhook-query-service.js';
import { WebhookDispatchService } from './application/webhook-dispatch-service.js';
import { PostgresWebhookDeliveryRepository } from './infrastructure/postgres-webhook-delivery-repository.js';
import { PostgresWebhookSubscriptionRepository } from './infrastructure/postgres-webhook-subscription-repository.js';

export function createWebhooksModule(deps) {
    const subscriptions = new PostgresWebhookSubscriptionRepository();
    const deliveries = new PostgresWebhookDeliveryRepository();
    const authorization = deps.authorization ?? new DefaultAuthorizationService();
    const sharedDeps = {
        database: deps.database,
        subscriptions,
        deliveries,
        secretEncryptor: deps.secretEncryptor,
        authorization,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const webhookCommandService = new DefaultWebhookCommandService(sharedDeps);
    const webhookQueryService = new DefaultWebhookQueryService(sharedDeps);
    return {
        webhookCommandService,
        webhookQueryService,
        repositories: {
            subscriptions,
            deliveries,
        },
    };
}

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../infrastructure/queue/bullmq-job-queue.js').BullMqJobQueue} deps.queue
 * @param {PostgresWebhookSubscriptionRepository} [deps.subscriptions]
 * @param {PostgresWebhookDeliveryRepository} [deps.deliveries]
 */
export function createWebhookDispatchService(deps) {
    return new WebhookDispatchService({
        database: deps.database,
        subscriptions: deps.subscriptions ?? new PostgresWebhookSubscriptionRepository(),
        deliveries: deps.deliveries ?? new PostgresWebhookDeliveryRepository(),
        queue: deps.queue,
    });
}
