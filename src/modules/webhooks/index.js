import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { DefaultWebhookCommandService } from './application/webhook-command-service.js';
import { DefaultWebhookQueryService } from './application/webhook-query-service.js';
import { validateOutboundWebhookUrl } from '../../shared/security/ssrf-validator.js';
import { WebhookDeliveryService } from './application/webhook-delivery-service.js';
import { WebhookDispatchService } from './application/webhook-dispatch-service.js';
import { PostgresWebhookDeliveryRepository } from './infrastructure/postgres-webhook-delivery-repository.js';
import { PostgresWebhookSubscriptionRepository } from './infrastructure/postgres-webhook-subscription-repository.js';
import webhookRoutes from './presentation/webhook.routes.js';

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
        rateLimiter: deps.rateLimiter,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
        ...(deps.stepUpVerifier === undefined ? {} : { stepUpVerifier: deps.stepUpVerifier }),
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
        routes: {
            plugin: webhookRoutes,
            options: {
                webhookCommandService,
                webhookQueryService,
            },
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

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../infrastructure/postgres/outbox-repository.js').PostgresOutboxRepository} deps.outbox
 * @param {import('../../infrastructure/http/fetch-http-client.js').FetchHttpClient} deps.httpClient
 * @param {import('../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {import('../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../app/config/config.js').AppConfig} deps.config
 * @param {PostgresWebhookSubscriptionRepository} [deps.subscriptions]
 * @param {PostgresWebhookDeliveryRepository} [deps.deliveries]
 * @param {(url: string) => Promise<URL>} [deps.ssrfValidator]
 */
export function createWebhookDeliveryService(deps) {
    return new WebhookDeliveryService({
        database: deps.database,
        subscriptions: deps.subscriptions ?? new PostgresWebhookSubscriptionRepository(),
        deliveries: deps.deliveries ?? new PostgresWebhookDeliveryRepository(),
        outbox: deps.outbox,
        httpClient: deps.httpClient,
        secretEncryptor: deps.secretEncryptor,
        logger: deps.logger,
        metrics: deps.metrics,
        ssrfValidator: deps.ssrfValidator ?? validateOutboundWebhookUrl,
        config: {
            timeoutMs: deps.config.webhooks.deliveryTimeoutMs,
            leaseSeconds: deps.config.webhooks.deliveryLeaseSeconds,
            maxRetryAfterSeconds: deps.config.webhooks.deliveryMaxRetryAfterSeconds,
        },
    });
}
