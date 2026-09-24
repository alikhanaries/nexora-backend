import { ConfigurationError } from '../../shared/errors/index.js';
import { configSchema } from './schema.js';
function toAppConfig(raw) {
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
            migrationUrl: raw.DATABASE_MIGRATION_URL,
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
        retention: {
            outboxDays: raw.OUTBOX_RETENTION_DAYS,
            inboxDays: raw.INBOX_RETENTION_DAYS,
            idempotencyDays: raw.IDEMPOTENCY_RETENTION_DAYS,
            webhookDeliveryDays: raw.WEBHOOK_DELIVERY_RETENTION_DAYS,
            batchSize: raw.RETENTION_CLEANUP_BATCH_SIZE,
            intervalMs: raw.RETENTION_CLEANUP_INTERVAL_MS,
        },
        catalogSyncReconciliation: {
            enabled: raw.CATALOG_SYNC_RECONCILIATION_ENABLED,
            intervalMs: raw.CATALOG_SYNC_RECONCILIATION_INTERVAL_MS,
            offerBatchSize: raw.CATALOG_SYNC_RECONCILIATION_OFFER_BATCH_SIZE,
            maxJobsPerTick: raw.CATALOG_SYNC_RECONCILIATION_MAX_JOBS_PER_TICK,
        },
        observability: {
            logLevel: raw.LOG_LEVEL,
            logPretty: raw.LOG_PRETTY && !isProduction,
            metricsEnabled: raw.METRICS_ENABLED,
            tracingEnabled: raw.TRACING_ENABLED,
            otlpEndpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
            serviceName: raw.OTEL_SERVICE_NAME,
        },
        workerObservability: {
            httpEnabled: raw.WORKER_OBSERVABILITY_HTTP_ENABLED,
            host: raw.WORKER_OBSERVABILITY_HOST,
            port: raw.WORKER_OBSERVABILITY_PORT,
            otelServiceName: raw.WORKER_OTEL_SERVICE_NAME ?? `${raw.OTEL_SERVICE_NAME}-worker`,
        },
        httpClient: {
            timeoutMs: raw.HTTP_CLIENT_TIMEOUT_MS,
        },
        webhooks: {
            deliveryTimeoutMs: raw.WEBHOOK_DELIVERY_TIMEOUT_MS,
            deliveryLeaseSeconds: raw.WEBHOOK_DELIVERY_LEASE_SECONDS,
            deliveryMaxRetryAfterSeconds: raw.WEBHOOK_DELIVERY_MAX_RETRY_AFTER_SECONDS,
        },
        security: {
            corsEnabled: raw.SERVER_CORS_ORIGINS.length > 0,
            allowedOrigins: raw.SERVER_CORS_ORIGINS,
            trustIncomingRequestId: raw.SERVER_TRUST_INCOMING_REQUEST_ID,
        },
        auth: {
            jwtSecret: raw.AUTH_JWT_SECRET,
            jwtPrivateKey: raw.AUTH_JWT_PRIVATE_KEY,
            jwtPublicKey: raw.AUTH_JWT_PUBLIC_KEY,
            accessTokenTtlSeconds: raw.AUTH_ACCESS_TOKEN_TTL_SECONDS,
            refreshTokenTtlSeconds: raw.AUTH_REFRESH_TOKEN_TTL_SECONDS,
            mfaEncryptionKey: raw.AUTH_MFA_ENCRYPTION_KEY,
            stepUpTtlSeconds: raw.AUTH_STEP_UP_TTL_SECONDS,
            passwordMinLength: raw.AUTH_PASSWORD_MIN_LENGTH,
            passwordMaxLength: raw.AUTH_PASSWORD_MAX_LENGTH,
        },
        docsEnabled: raw.DOCS_ENABLED,
    };
}
function assertConsistency(config) {
    const problems = [];
    if (config.database.pool.min > config.database.pool.max) {
        problems.push('DATABASE_POOL_MIN must not exceed DATABASE_POOL_MAX');
    }
    if (config.observability.tracingEnabled && config.observability.otlpEndpoint === undefined) {
        problems.push('TRACING_ENABLED requires OTEL_EXPORTER_OTLP_ENDPOINT to be set');
    }
    if (config.isProduction && config.security.allowedOrigins.includes('*')) {
        problems.push('SERVER_CORS_ORIGINS must list exact origins; "*" is not allowed');
    }
    const hasJwtKeys = config.auth.jwtPrivateKey !== undefined && config.auth.jwtPublicKey !== undefined;
    if (!hasJwtKeys && config.auth.jwtSecret === undefined) {
        problems.push('Either AUTH_JWT_SECRET or both AUTH_JWT_PRIVATE_KEY and AUTH_JWT_PUBLIC_KEY must be set');
    }
    if (config.auth.mfaEncryptionKey.length !== 32) {
        problems.push('AUTH_MFA_ENCRYPTION_KEY must be exactly 32 bytes');
    }
    if (config.database.migrationUrl !== undefined && !URL.canParse(config.database.migrationUrl)) {
        problems.push('DATABASE_MIGRATION_URL must be a valid URL when set');
    }
    if (config.webhooks.deliveryTimeoutMs > config.webhooks.deliveryLeaseSeconds * 1_000) {
        problems.push('WEBHOOK_DELIVERY_TIMEOUT_MS must not exceed WEBHOOK_DELIVERY_LEASE_SECONDS');
    }
    if (problems.length > 0) {
        throw new ConfigurationError('Configuration is inconsistent', { problems });
    }
}
export function loadConfig(source) {
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
