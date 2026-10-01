import { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import { createPinoLogger } from '../../infrastructure/observability/pino-logger.js';
import { PrometheusMetrics } from '../../infrastructure/observability/prometheus-metrics.js';
import { RedisConnection } from '../../infrastructure/redis/redis-client.js';
import { RedisKeyBuilder } from '../../infrastructure/redis/redis-keys.js';
import { RedisRateLimiter } from '../../infrastructure/redis/redis-rate-limiter.js';
import { noopMetricsRecorder } from '../../shared/metrics/index.js';
import { describeErrorForLog } from '../../shared/errors/index.js';

/**
 * Nest infrastructure: logger, metrics, Postgres, Redis rate limiter (auth login).
 *
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {{ connectDatabase?: boolean, connectRedis?: boolean, runMigrations?: boolean }} [options]
 */
export async function createNestInfrastructure(config, options = {}) {
  const connectDatabase = options.connectDatabase ?? true;
  const connectRedis = options.connectRedis ?? connectDatabase;
  const runMigrations = options.runMigrations ?? true;

  const logger = createPinoLogger(config);
  const metrics = config.observability.metricsEnabled
    ? new PrometheusMetrics(config.observability.serviceName)
    : noopMetricsRecorder;

  if (!connectDatabase) {
    logger.info({}, 'Nest infrastructure: database connection skipped');
    return { logger, metrics, database: null, redis: null, rateLimiter: null };
  }

  const database = new PostgresDatabase({
    config: config.database,
    logger,
    metrics,
  });

  let redis = null;
  let rateLimiter = null;

  try {
    if (runMigrations) {
      await database.runMigrations({
        migrationUrl: config.database.migrationUrl,
        runtimeUrl: config.database.url,
      });
    }
    await database.healthCheck();
    logger.info({}, 'Nest infrastructure: PostgreSQL ready');

    if (connectRedis) {
      redis = new RedisConnection({ config: config.redis, logger, metrics });
      await redis.connect();
      const redisKeys = new RedisKeyBuilder(config.redis.keyPrefix, config.instanceNamespace);
      rateLimiter = new RedisRateLimiter(redis, redisKeys, metrics, logger);
      logger.info({}, 'Nest infrastructure: Redis ready');
    }
  } catch (error) {
    logger.error({ err: describeErrorForLog(error) }, 'Nest infrastructure startup failed');
    if (redis !== null) {
      await redis.close().catch(() => {});
    }
    throw error;
  }

  return { logger, metrics, database, redis, rateLimiter };
}
