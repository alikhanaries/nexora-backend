/**
 * Outbound merchant webhooks: subscription and delivery repositories, command/query services,
 * plus standalone dispatch (queue) and delivery (HTTP/outbox) factories for background workers.
 */
import { createDefaultAuthorizationService } from '../../authorization/public/index.js';
import { createDefaultWebhookCommandService } from './services/webhook-command-service.js';
import { createDefaultWebhookQueryService } from './services/webhook-query-service.js';
import { validateOutboundWebhookUrl } from '../../../shared/security/ssrf-validator.js';
import { createWebhookDeliveryService as buildWebhookDeliveryService } from './services/webhook-delivery-service.js';
import { createWebhookDispatchService as buildWebhookDispatchService } from './services/webhook-dispatch-service.js';
import { createPostgresWebhookDeliveryRepository } from './repositories/postgres-webhook-delivery-repository.js';
import { createPostgresWebhookSubscriptionRepository } from './repositories/postgres-webhook-subscription-repository.js';

/**
 * @param {object} deps
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {import('../../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 * @param {ReturnType<typeof import('../../authorization/public/index.js').createDefaultAuthorizationService>} [deps.authorization]
 * @param {import('../../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @param {import('../../mfa/public/index.js').StepUpVerifierPort} [deps.stepUpVerifier]
 * @returns {{ webhookCommandService: object, webhookQueryService: object, repositories: { subscriptions: object, deliveries: object } }}
 */
export function createWebhooksModule(deps) {
    const subscriptions = createPostgresWebhookSubscriptionRepository();
    const deliveries = createPostgresWebhookDeliveryRepository();
    const authorization = deps.authorization ?? createDefaultAuthorizationService();
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
    const webhookCommandService = createDefaultWebhookCommandService(sharedDeps);
    const webhookQueryService = createDefaultWebhookQueryService(sharedDeps);
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
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../../infrastructure/queue/bullmq-job-queue.js').BullMqJobQueue} deps.queue
 * @param {ReturnType<typeof createPostgresWebhookSubscriptionRepository>} [deps.subscriptions]
 * @param {ReturnType<typeof createPostgresWebhookDeliveryRepository>} [deps.deliveries]
 * @returns {ReturnType<typeof buildWebhookDispatchService>}
 */
export function createWebhookDispatchService(deps) {
    return buildWebhookDispatchService({
        database: deps.database,
        subscriptions: deps.subscriptions ?? createPostgresWebhookSubscriptionRepository(),
        deliveries: deps.deliveries ?? createPostgresWebhookDeliveryRepository(),
        queue: deps.queue,
    });
}

/**
 * @param {object} deps
 * @param {import('../../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../../infrastructure/postgres/outbox-repository.js').PostgresOutboxRepository} deps.outbox
 * @param {{ send: Function }} deps.httpClient
 * @param {import('../../../shared/security/secret-encryptor.port.js').SecretEncryptorPort} deps.secretEncryptor
 * @param {import('../../../shared/logging/logger.port.js').Logger} deps.logger
 * @param {import('../../../shared/metrics/metrics-recorder.js').MetricsRecorder} [deps.metrics]
 * @param {import('../../../app/config/config.js').AppConfig} deps.config
 * @param {ReturnType<typeof createPostgresWebhookSubscriptionRepository>} [deps.subscriptions]
 * @param {ReturnType<typeof createPostgresWebhookDeliveryRepository>} [deps.deliveries]
 * @param {(url: string) => Promise<URL>} [deps.ssrfValidator]
 * @returns {ReturnType<typeof buildWebhookDeliveryService>}
 */
export function createWebhookDeliveryService(deps) {
    return buildWebhookDeliveryService({
        database: deps.database,
        subscriptions: deps.subscriptions ?? createPostgresWebhookSubscriptionRepository(),
        deliveries: deps.deliveries ?? createPostgresWebhookDeliveryRepository(),
        outbox: deps.outbox,
        httpClient: deps.httpClient,
        secretEncryptor: deps.secretEncryptor,
        logger: deps.logger,
        metrics: deps.metrics,
        ssrfValidator: deps.ssrfValidator ?? validateOutboundWebhookUrl,
        ...(deps.webhookPayloadStrategies === undefined
            ? {}
            : { webhookPayloadStrategies: deps.webhookPayloadStrategies }),
        config: {
            timeoutMs: deps.config.webhooks.deliveryTimeoutMs,
            leaseSeconds: deps.config.webhooks.deliveryLeaseSeconds,
            maxRetryAfterSeconds: deps.config.webhooks.deliveryMaxRetryAfterSeconds,
        },
    });
}
