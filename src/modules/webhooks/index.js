import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { DefaultWebhookCommandService } from './application/webhook-command-service.js';
import { DefaultWebhookQueryService } from './application/webhook-query-service.js';
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
