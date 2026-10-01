import { PostgresDatabase } from '../../infrastructure/postgres/postgres-database.js';
import { createPinoLogger } from '../../infrastructure/observability/pino-logger.js';
import { PrometheusMetrics } from '../../infrastructure/observability/prometheus-metrics.js';
import { noopMetricsRecorder } from '../../shared/metrics/index.js';
import { describeErrorForLog } from '../../shared/errors/index.js';

/**
 * Minimal Nest infrastructure (Phase 3): logger + metrics + Postgres — same building blocks as Fastify bootstrap.
 *
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {{ connectDatabase?: boolean, runMigrations?: boolean }} [options]
 */
export async function createNestInfrastructure(config, options = {}) {
  const connectDatabase = options.connectDatabase ?? true;
  const runMigrations = options.runMigrations ?? true;

  const logger = createPinoLogger(config);
  const metrics = config.observability.metricsEnabled
    ? new PrometheusMetrics(config.observability.serviceName)
    : noopMetricsRecorder;

  if (!connectDatabase) {
    logger.info({}, 'Nest infrastructure: database connection skipped');
    return { logger, metrics, database: null };
  }

  const database = new PostgresDatabase({
    config: config.database,
    logger,
    metrics,
  });

  try {
    if (runMigrations) {
      await database.runMigrations({
        migrationUrl: config.database.migrationUrl,
        runtimeUrl: config.database.url,
      });
    }
    await database.healthCheck();
    logger.info({}, 'Nest infrastructure: PostgreSQL ready');
  } catch (error) {
    logger.error({ err: describeErrorForLog(error) }, 'Nest infrastructure: PostgreSQL failed');
    throw error;
  }

  return { logger, metrics, database };
}
