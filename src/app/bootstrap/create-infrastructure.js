import { FetchHttpClient } from '../../infrastructure/http/fetch-http-client.js';
import { PostgresInboxRepository } from '../../infrastructure/postgres/inbox-repository.js';
import { PostgresIdempotencyService } from '../../infrastructure/postgres/idempotency-service.js';
import { PostgresOutboxRepository } from '../../infrastructure/postgres/outbox-repository.js';
import { OutboxPublisher } from '../../infrastructure/postgres/outbox-publisher.js';
import { RetentionCleanupScheduler } from '../../infrastructure/postgres/retention-cleanup-scheduler.js';
import { RetentionCleanupService } from '../../infrastructure/postgres/retention-cleanup-service.js';
import { WebhookDeliveryRetention } from '../../infrastructure/postgres/webhook-delivery-retention.js';
import { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import { BullMqJobQueue, createQueueRedisConnection, } from '../../infrastructure/queue/bullmq-job-queue.js';
import { BullMqWorkerRuntime } from '../../infrastructure/queue/bullmq-worker-runtime.js';
import { createPinoLogger } from '../../infrastructure/observability/pino-logger.js';
import { PrometheusMetrics } from '../../infrastructure/observability/prometheus-metrics.js';
import { startTracing } from '../../infrastructure/observability/tracing.js';
import { RedisCache } from '../../infrastructure/redis/redis-cache.js';
import { RedisConnection } from '../../infrastructure/redis/redis-client.js';
import { RedisDistributedLock } from '../../infrastructure/redis/redis-distributed-lock.js';
import { RedisKeyBuilder } from '../../infrastructure/redis/redis-keys.js';
import { RedisRateLimiter } from '../../infrastructure/redis/redis-rate-limiter.js';
import { S3StorageProvider } from '../../infrastructure/storage/s3-storage-provider.js';
import { noopMetricsRecorder } from '../../shared/metrics/index.js';
export async function createInfrastructure(config) {
    const logger = createPinoLogger(config);
    const metrics = config.observability.metricsEnabled
        ? new PrometheusMetrics(config.observability.serviceName)
        : noopMetricsRecorder;
    const tracing = startTracing(config, logger);
    const database = new PostgresDatabase({ config: config.database, logger, metrics });
    await database.runMigrations({
        migrationUrl: config.database.migrationUrl,
        runtimeUrl: config.database.url,
    });
    const redis = new RedisConnection({ config: config.redis, logger, metrics });
    await redis.connect();
    const redisKeys = new RedisKeyBuilder(config.redis.keyPrefix, config.instanceNamespace);
    const cache = new RedisCache(redis, redisKeys, logger);
    const lock = new RedisDistributedLock(redis, redisKeys);
    const rateLimiter = new RedisRateLimiter(redis, redisKeys, metrics, logger);
    const queueConnection = createQueueRedisConnection(config.queue);
    const queue = new BullMqJobQueue(queueConnection, config.queue, logger, metrics);
    const workerRuntime = new BullMqWorkerRuntime(queueConnection, config.queue, logger, metrics);
    const storage = new S3StorageProvider(config.storage, logger);
    const httpClient = new FetchHttpClient({ config: config.httpClient, logger });
    const outbox = new PostgresOutboxRepository(database);
    const outboxPublisher = new OutboxPublisher(outbox, queue, config.outbox, logger);
    const inbox = new PostgresInboxRepository(database);
    const idempotency = new PostgresIdempotencyService(database, config.idempotency);
    const webhookDeliveryRetention = new WebhookDeliveryRetention(database);
    const retentionCleanupService = new RetentionCleanupService(outbox, inbox, idempotency, webhookDeliveryRetention, config.retention, logger, metrics);
    const retentionCleanupLockTtlSeconds = Math.max(300, Math.ceil(config.retention.intervalMs / 1_000));
    const retentionCleanupScheduler = new RetentionCleanupScheduler(retentionCleanupService, lock, config.retention, logger, retentionCleanupLockTtlSeconds);
    return {
        config,
        logger,
        metrics,
        tracing,
        database,
        redis,
        redisKeys,
        cache,
        lock,
        rateLimiter,
        queue,
        queueConnection,
        workerRuntime,
        storage,
        httpClient,
        outbox,
        outboxPublisher,
        inbox,
        idempotency,
        retentionCleanupService,
        retentionCleanupScheduler,
        eventRecorder: outbox,
    };
}
