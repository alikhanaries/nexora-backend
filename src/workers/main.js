import { loadConfigFromEnvironment } from '../app/config/index.js';
import { createInfrastructure } from '../app/bootstrap/create-infrastructure.js';
import { gracefulShutdown } from '../app/bootstrap/shutdown.js';
import { createWorkerReadinessProbes, ReadinessService, } from '../app/observability/readiness.js';
import { AesSecretEncryptor } from '../infrastructure/auth/aes-secret-encryptor.js';
import { createWebhookDeliveryService, createWebhookDispatchService } from '../modules/webhooks/index.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import { createIntegrationEventConsumers } from './create-integration-event-consumers.js';
import { registerWorkerHandlers } from './handlers/queue-job-handlers.js';
import { CatalogSyncEnqueueHandler } from './handlers/catalog-sync-enqueue.handler.js';
import { CatalogSyncReconciliationScheduler } from '../modules/channel-catalog-sync/application/catalog-sync-reconciliation-scheduler.js';
import { wireChannelCatalogSync } from './bootstrap/wire-channel-catalog-sync.js';
import { createWorkerObservabilityHttpServer } from './observability/create-worker-observability-http-server.js';
async function main() {
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config, { processKind: 'worker' });
    const webhookDispatchService = createWebhookDispatchService({
        database: infra.database,
        queue: infra.queue,
    });
    const webhookDeliveryService = createWebhookDeliveryService({
        database: infra.database,
        outbox: infra.outbox,
        httpClient: infra.httpClient,
        secretEncryptor,
        logger: infra.logger,
        metrics: infra.metrics,
        config,
    });
    const secretEncryptor = new AesSecretEncryptor(config.auth.mfaEncryptionKey);
    const { channelCatalogSyncService, catalogSyncReconciliationService } = wireChannelCatalogSync({
        database: infra.database,
        queue: infra.queue,
        rateLimiter: infra.rateLimiter,
        metrics: infra.metrics,
        logger: infra.logger,
        catalogSyncReconciliation: config.catalogSyncReconciliation,
        secretEncryptor,
        shopifyAdminApiVersion: config.marketplace.shopifyAdminApiVersion,
    });
    const catalogSyncReconciliationLockTtlSeconds = Math.max(300, Math.ceil(config.catalogSyncReconciliation.intervalMs / 1_000));
    const catalogSyncReconciliationScheduler = new CatalogSyncReconciliationScheduler(catalogSyncReconciliationService, infra.lock, config.catalogSyncReconciliation, infra.logger, catalogSyncReconciliationLockTtlSeconds);
    const catalogSyncEnqueueHandler = new CatalogSyncEnqueueHandler(channelCatalogSyncService);
    const { integrationEventRouter } = createIntegrationEventConsumers({
        database: infra.database,
        inbox: infra.inbox,
        logger: infra.logger,
        webhookDispatchService,
        catalogSyncEnqueueHandler,
    });
    registerWorkerHandlers({
        workerRuntime: infra.workerRuntime,
        integrationEventRouter,
        webhookDeliveryService,
        channelCatalogSyncService,
    });
    const readiness = new ReadinessService(createWorkerReadinessProbes({
        database: infra.database,
        redis: infra.redis,
        queue: infra.queue,
        workerRuntime: infra.workerRuntime,
    }));
    let workerObservabilityHttp;
    if (config.workerObservability.httpEnabled) {
        workerObservabilityHttp = await createWorkerObservabilityHttpServer({
            readiness,
            metrics: infra.metrics,
            metricsEnabled: config.observability.metricsEnabled,
        });
        await workerObservabilityHttp.listen({
            host: config.workerObservability.host,
            port: config.workerObservability.port,
        });
        infra.logger.info({
            host: config.workerObservability.host,
            port: config.workerObservability.port,
        }, 'Worker observability HTTP started');
    }
    infra.retentionCleanupScheduler.start();
    catalogSyncReconciliationScheduler.start();
    const poolMetricsTimer = setInterval(() => {
        infra.database.reportPoolMetrics();
    }, 5_000);
    infra.logger.info({}, 'Worker started');
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        infra.logger.info({ signal }, 'Worker shutdown signal received');
        clearInterval(poolMetricsTimer);
        await gracefulShutdown({
            readiness,
            workerObservabilityHttp,
            workerRuntime: infra.workerRuntime,
            retentionCleanupScheduler: infra.retentionCleanupScheduler,
            catalogSyncReconciliationScheduler,
            queue: infra.queue,
            redis: infra.redis,
            database: infra.database,
            tracing: infra.tracing,
            logger: infra.logger,
            timeoutMs: config.server.shutdownTimeoutMs,
        });
        process.exit(0);
    };
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });
}
main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ msg: 'Worker startup failed', err: describeErrorForLog(error) })}\n`);
    process.exitCode = 1;
});
