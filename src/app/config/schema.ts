import { z } from 'zod';
import {
  envBoolean,
  envInteger,
  envOptionalString,
  envString,
  envStringList,
  envUrl,
} from './env-parsers.js';

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * The single source of truth for every environment variable the application
 * understands. Anything not declared here is ignored, which makes typos in
 * deployment manifests visible instead of silently changing behaviour.
 */
export const configSchema = z.object({
  NODE_ENV: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? 'development')
    .pipe(z.enum(NODE_ENVIRONMENTS)),
  APP_NAME: envString('nexora-backend'),
  APP_INSTANCE_NAMESPACE: envString('local'),

  SERVER_HOST: envString('0.0.0.0'),
  SERVER_PORT: envInteger({ default: 3000, min: 1, max: 65_535 }),
  SERVER_SHUTDOWN_TIMEOUT_MS: envInteger({ default: 15_000, min: 0, max: 300_000 }),
  SERVER_BODY_LIMIT_BYTES: envInteger({ default: 1_048_576, min: 1_024, max: 104_857_600 }),
  SERVER_CORS_ORIGINS: envStringList(),
  SERVER_TRUST_INCOMING_REQUEST_ID: envBoolean(false),
  SERVER_TRUST_PROXY: envBoolean(false),

  DATABASE_URL: envUrl(),
  DATABASE_POOL_MAX: envInteger({ default: 10, min: 1, max: 1_000 }),
  DATABASE_POOL_MIN: envInteger({ default: 0, min: 0, max: 1_000 }),
  DATABASE_CONNECTION_TIMEOUT_MS: envInteger({ default: 5_000, min: 100, max: 120_000 }),
  DATABASE_IDLE_TIMEOUT_MS: envInteger({ default: 30_000, min: 1_000, max: 600_000 }),
  DATABASE_STATEMENT_TIMEOUT_MS: envInteger({ default: 15_000, min: 100, max: 600_000 }),
  DATABASE_QUERY_TIMEOUT_MS: envInteger({ default: 15_000, min: 100, max: 600_000 }),
  DATABASE_SSL: envBoolean(false),

  REDIS_URL: envUrl(),
  REDIS_KEY_PREFIX: envString('nexora'),
  REDIS_CONNECT_TIMEOUT_MS: envInteger({ default: 5_000, min: 100, max: 120_000 }),
  REDIS_COMMAND_TIMEOUT_MS: envInteger({ default: 5_000, min: 100, max: 120_000 }),

  QUEUE_REDIS_URL: envOptionalString(),
  QUEUE_PREFIX: envString('nexora-queue'),
  QUEUE_DEFAULT_ATTEMPTS: envInteger({ default: 5, min: 1, max: 50 }),
  QUEUE_BACKOFF_BASE_MS: envInteger({ default: 1_000, min: 10, max: 600_000 }),
  QUEUE_WORKER_CONCURRENCY: envInteger({ default: 5, min: 1, max: 500 }),
  QUEUE_JOB_TIMEOUT_MS: envInteger({ default: 30_000, min: 100, max: 600_000 }),

  STORAGE_ENDPOINT: envOptionalString(),
  STORAGE_REGION: envString('us-east-1'),
  STORAGE_BUCKET: envString(),
  STORAGE_ACCESS_KEY_ID: envString(),
  STORAGE_SECRET_ACCESS_KEY: envString(),
  STORAGE_FORCE_PATH_STYLE: envBoolean(true),

  OUTBOX_BATCH_SIZE: envInteger({ default: 100, min: 1, max: 1_000 }),
  OUTBOX_POLL_INTERVAL_MS: envInteger({ default: 1_000, min: 50, max: 60_000 }),
  OUTBOX_MAX_ATTEMPTS: envInteger({ default: 10, min: 1, max: 100 }),

  IDEMPOTENCY_TTL_SECONDS: envInteger({ default: 86_400, min: 60, max: 2_592_000 }),

  LOG_LEVEL: z
    .string()
    .optional()
    .transform((value) => value?.trim().toLowerCase() ?? 'info')
    .pipe(z.enum(LOG_LEVELS)),
  LOG_PRETTY: envBoolean(false),
  METRICS_ENABLED: envBoolean(true),
  TRACING_ENABLED: envBoolean(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: envOptionalString(),
  OTEL_SERVICE_NAME: envString('nexora-backend'),

  HTTP_CLIENT_TIMEOUT_MS: envInteger({ default: 10_000, min: 100, max: 300_000 }),

  DOCS_ENABLED: envBoolean(true),

  AUTH_JWT_SECRET: envOptionalString(),
  AUTH_JWT_PRIVATE_KEY: envOptionalString(),
  AUTH_JWT_PUBLIC_KEY: envOptionalString(),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: envInteger({ default: 900, min: 60, max: 86_400 }),
  AUTH_REFRESH_TOKEN_TTL_SECONDS: envInteger({ default: 2_592_000, min: 3_600, max: 31_536_000 }),
  AUTH_MFA_ENCRYPTION_KEY: envString('0123456789abcdef0123456789abcdef'),
  AUTH_STEP_UP_TTL_SECONDS: envInteger({ default: 900, min: 60, max: 3_600 }),
  AUTH_PASSWORD_MIN_LENGTH: envInteger({ default: 12, min: 8, max: 128 }),
  AUTH_PASSWORD_MAX_LENGTH: envInteger({ default: 128, min: 12, max: 256 }),
});

export type RawConfig = z.infer<typeof configSchema>;
