import { ConfigurationError } from '../../shared/errors/index.js';
import type { AppConfig } from '../../shared/config/index.js';
import { configSchema, type RawConfig } from './schema.js';

export type {
  AppConfig,
  DatabaseConfig,
  HttpClientConfig,
  IdempotencyConfig,
  LogLevel,
  NodeEnvironment,
  ObservabilityConfig,
  OutboxConfig,
  QueueConfig,
  RedisConfig,
  SecurityConfig,
  ServerConfig,
  StorageConfig,
} from '../../shared/config/index.js';

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function toAppConfig(raw: RawConfig): AppConfig {
  const isProduction = raw.NODE_ENV === 'production';

  return {
    env: raw.NODE_ENV,
    isProduction,
    isTest: raw.NODE_ENV === 'test',
    appName: raw.APP_NAME,
    instanceNamespace: raw.APP_INSTANCE_NAMESPACE,
    server: {
      host: raw.SERVER_HOST,
      port: raw.SERVER_PORT,
      shutdownTimeoutMs: raw.SERVER_SHUTDOWN_TIMEOUT_MS,
      bodyLimitBytes: raw.SERVER_BODY_LIMIT_BYTES,
      corsOrigins: raw.SERVER_CORS_ORIGINS,
      trustIncomingRequestId: raw.SERVER_TRUST_INCOMING_REQUEST_ID,
      trustProxy: raw.SERVER_TRUST_PROXY,
    },
    database: {
      url: raw.DATABASE_URL,
      ssl: raw.DATABASE_SSL,
      pool: {
        max: raw.DATABASE_POOL_MAX,
        min: raw.DATABASE_POOL_MIN,
        connectionTimeoutMs: raw.DATABASE_CONNECTION_TIMEOUT_MS,
        idleTimeoutMs: raw.DATABASE_IDLE_TIMEOUT_MS,
        statementTimeoutMs: raw.DATABASE_STATEMENT_TIMEOUT_MS,
        queryTimeoutMs: raw.DATABASE_QUERY_TIMEOUT_MS,
      },
    },
    redis: {
      url: raw.REDIS_URL,
      keyPrefix: raw.REDIS_KEY_PREFIX,
      connectTimeoutMs: raw.REDIS_CONNECT_TIMEOUT_MS,
      commandTimeoutMs: raw.REDIS_COMMAND_TIMEOUT_MS,
    },
    queue: {
      redisUrl: raw.QUEUE_REDIS_URL ?? raw.REDIS_URL,
      prefix: raw.QUEUE_PREFIX,
      defaultAttempts: raw.QUEUE_DEFAULT_ATTEMPTS,
      backoffBaseMs: raw.QUEUE_BACKOFF_BASE_MS,
      workerConcurrency: raw.QUEUE_WORKER_CONCURRENCY,
      jobTimeoutMs: raw.QUEUE_JOB_TIMEOUT_MS,
    },
    storage: {
      endpoint: raw.STORAGE_ENDPOINT,
      region: raw.STORAGE_REGION,
      bucket: raw.STORAGE_BUCKET,
      accessKeyId: raw.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: raw.STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: raw.STORAGE_FORCE_PATH_STYLE,
    },
    outbox: {
      batchSize: raw.OUTBOX_BATCH_SIZE,
      pollIntervalMs: raw.OUTBOX_POLL_INTERVAL_MS,
      maxAttempts: raw.OUTBOX_MAX_ATTEMPTS,
    },
    idempotency: {
      ttlSeconds: raw.IDEMPOTENCY_TTL_SECONDS,
    },
    observability: {
      logLevel: raw.LOG_LEVEL,
      logPretty: raw.LOG_PRETTY && !isProduction,
      metricsEnabled: raw.METRICS_ENABLED,
      tracingEnabled: raw.TRACING_ENABLED,
      otlpEndpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
      serviceName: raw.OTEL_SERVICE_NAME,
    },
    httpClient: {
      timeoutMs: raw.HTTP_CLIENT_TIMEOUT_MS,
    },
    security: {
      corsEnabled: raw.SERVER_CORS_ORIGINS.length > 0,
      allowedOrigins: raw.SERVER_CORS_ORIGINS,
      trustIncomingRequestId: raw.SERVER_TRUST_INCOMING_REQUEST_ID,
    },
    docsEnabled: raw.DOCS_ENABLED,
  };
}

function assertConsistency(config: AppConfig): void {
  const problems: string[] = [];

  if (config.database.pool.min > config.database.pool.max) {
    problems.push('DATABASE_POOL_MIN must not exceed DATABASE_POOL_MAX');
  }
  if (config.observability.tracingEnabled && config.observability.otlpEndpoint === undefined) {
    problems.push('TRACING_ENABLED requires OTEL_EXPORTER_OTLP_ENDPOINT to be set');
  }
  if (config.isProduction && config.security.allowedOrigins.includes('*')) {
    problems.push('SERVER_CORS_ORIGINS must list exact origins; "*" is not allowed');
  }

  if (problems.length > 0) {
    throw new ConfigurationError('Configuration is inconsistent', { problems });
  }
}

export function loadConfig(source: EnvironmentSource): AppConfig {
  const parsed = configSchema.safeParse(source);

  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const variable = issue.path.join('.') || '(root)';
      return `${variable}: ${issue.message}`;
    });
    throw new ConfigurationError('Invalid application configuration', { problems });
  }

  const config = toAppConfig(parsed.data);
  assertConsistency(config);
  return config;
}
