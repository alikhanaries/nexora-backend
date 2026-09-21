import type { AppConfig } from '../config/index.js';
import { FetchHttpClient } from '../../infrastructure/http/fetch-http-client.js';
import { PostgresInboxRepository } from '../../infrastructure/postgres/inbox-repository.js';
import { PostgresIdempotencyService } from '../../infrastructure/postgres/idempotency-service.js';
import { PostgresOutboxRepository } from '../../infrastructure/postgres/outbox-repository.js';
import { OutboxPublisher } from '../../infrastructure/postgres/outbox-publisher.js';
import { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import {
  BullMqJobQueue,
  createQueueRedisConnection,
} from '../../infrastructure/queue/bullmq-job-queue.js';
import { BullMqWorkerRuntime } from '../../infrastructure/queue/bullmq-worker-runtime.js';
import { createPinoLogger } from '../../infrastructure/observability/pino-logger.js';
import { PrometheusMetrics } from '../../infrastructure/observability/prometheus-metrics.js';
import { startTracing, type Tracing } from '../../infrastructure/observability/tracing.js';
import { RedisCache } from '../../infrastructure/redis/redis-cache.js';
import { RedisConnection } from '../../infrastructure/redis/redis-client.js';
import { RedisDistributedLock } from '../../infrastructure/redis/redis-distributed-lock.js';
import { RedisKeyBuilder } from '../../infrastructure/redis/redis-keys.js';
import { RedisRateLimiter } from '../../infrastructure/redis/redis-rate-limiter.js';
import { S3StorageProvider } from '../../infrastructure/storage/s3-storage-provider.js';
import type { CacheService, DistributedLock } from '../../shared/cache/index.js';
import type { EventRecorder, InboxStore } from '../../shared/events/index.js';
import type { HttpClient } from '../../shared/http/index.js';
import type { IdempotencyService } from '../../shared/idempotency/index.js';
import type { Logger } from '../../shared/logging/index.js';
import { noopMetricsRecorder } from '../../shared/metrics/index.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';
import type { JobQueue } from '../../shared/queue/index.js';
import type { RateLimitService } from '../../shared/rate-limit/index.js';
import type { StorageProvider } from '../../shared/storage/index.js';

export interface Infrastructure {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRecorder;
  readonly tracing: Tracing;
  readonly database: PostgresDatabase;
  readonly redis: RedisConnection;
  readonly redisKeys: RedisKeyBuilder;
  readonly cache: CacheService;
  readonly lock: DistributedLock;
  readonly rateLimiter: RateLimitService;
  readonly queue: JobQueue;
  readonly queueConnection: ReturnType<typeof createQueueRedisConnection>;
  readonly workerRuntime: BullMqWorkerRuntime;
  readonly storage: StorageProvider;
  readonly httpClient: HttpClient;
  readonly outbox: PostgresOutboxRepository;
  readonly outboxPublisher: OutboxPublisher;
  readonly inbox: InboxStore;
  readonly idempotency: IdempotencyService;
  readonly eventRecorder: EventRecorder;
}

export async function createInfrastructure(config: AppConfig): Promise<Infrastructure> {
  const logger = createPinoLogger(config);
  const metrics: MetricsRecorder = config.observability.metricsEnabled
    ? new PrometheusMetrics(config.observability.serviceName)
    : noopMetricsRecorder;
  const tracing = startTracing(config, logger);

  const database = new PostgresDatabase({ config: config.database, logger, metrics });
  await database.runMigrations();

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
    eventRecorder: outbox,
  };
}
