import { loadConfigFromEnvironment } from '../app/config/index.js';
import { createInfrastructure } from '../app/create-infrastructure.js';
import { disposeInfrastructureResources } from '../app/dispose-infrastructure.js';
import { gracefulShutdown } from '../app/shutdown.js';
import { createWorkerReadinessProbes, ReadinessService, } from '../app/observability/readiness.js';
import { AesSecretEncryptor } from '../infrastructure/auth/aes-secret-encryptor.js';
import { createWebhookDeliveryService, createWebhookDispatchService } from '../modules/webhooks/index.js';
import { wireExternalConsumerWebhookPayloadStrategies } from './wire-external-consumer-webhook-payload-strategies.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import { createIntegrationEventConsumers } from './create-integration-event-consumers.js';
import { registerWorkerHandlers } from './handlers/queue-job-handlers.js';
import { CatalogSyncEnqueueHandler } from './handlers/catalog-sync-enqueue.handler.js';
import { CatalogSyncReconciliationScheduler } from '../modules/integration-catalog-sync/services/catalog-sync-reconciliation-scheduler.js';
import { wireIntegrationCatalogSync } from './wire-integration-catalog-sync.js';
import { wireMarketplaceLifecycleWorker } from './wire-marketplace-lifecycle-worker.js';
import { createWorkerMarketplaceCommerceDeps } from './create-worker-marketplace-commerce-deps.js';
import { startWorkerObservabilityHttp } from './observability/start-worker-observability-http.js';
async function main() {
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config, { processKind: 'worker' });
    /** @type {InstanceType<typeof ReadinessService> | undefined} */
    let readiness;
    /** @type {{ close: () => Promise<void> } | undefined} */
    let workerObservabilityHttp;
    /** @type {InstanceType<typeof CatalogSyncReconciliationScheduler> | undefined} */
    let catalogSyncReconciliationScheduler;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let poolMetricsTimer;
    try {
        const secretEncryptor = new AesSecretEncryptor(config.auth.mfaEncryptionKey);
        const webhookDispatchService = createWebhookDispatchService({
            database: infra.database,
            queue: infra.queue,
        });
        const { channelCatalogSyncService, catalogSyncReconciliationService } = wireIntegrationCatalogSync({
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
        catalogSyncReconciliationScheduler = new CatalogSyncReconciliationScheduler(catalogSyncReconciliationService, infra.lock, config.catalogSyncReconciliation, infra.logger, catalogSyncReconciliationLockTtlSeconds);
        const catalogSyncEnqueueHandler = new CatalogSyncEnqueueHandler(channelCatalogSyncService);
        const {
            marketplaceOrderIngestion,
            executeOutboundMarketplaceOrderLifecycle,
            orderQueryService,
            commerceIntegrationQueryService,
            externalIntegerIdMappingQueryService,
        } = createWorkerMarketplaceCommerceDeps(infra, secretEncryptor);
        const webhookDeliveryService = createWebhookDeliveryService({
            database: infra.database,
            outbox: infra.outbox,
            httpClient: infra.httpClient,
            secretEncryptor,
            logger: infra.logger,
            metrics: infra.metrics,
            config,
            webhookPayloadStrategies: wireExternalConsumerWebhookPayloadStrategies({
                orderQueryService,
                commerceIntegrationQueryService,
                externalIntegerIdMappingQueryService,
            }),
        });
        const { executeMarketplaceLifecycleJob } = wireMarketplaceLifecycleWorker({
            database: infra.database,
            queue: infra.queue,
            metrics: infra.metrics,
            logger: infra.logger,
            config,
            ingestNormalizedMarketplaceOrder: marketplaceOrderIngestion.ingestNormalizedMarketplaceOrder,
            lifecycleService: marketplaceOrderIngestion.lifecycleService,
            processMarketplaceLifecyclePayload: marketplaceOrderIngestion.processMarketplaceLifecyclePayload,
            executeOutboundMarketplaceOrderLifecycle,
            orderAdapterRegistry: marketplaceOrderIngestion.orderAdapterRegistry,
            marketplaceAdapterRuntimeFactory: marketplaceOrderIngestion.marketplaceAdapterRuntimeFactory,
            commerceIntegrationQueryService: marketplaceOrderIngestion.commerceIntegrationQueryService,
            marketplaceLookup: marketplaceOrderIngestion.marketplaceLookup,
        });
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
            executeMarketplaceLifecycleJob,
            marketplaceLifecycleQueueName: config.marketplaceLifecycle.queueName,
        });
        readiness = new ReadinessService(createWorkerReadinessProbes({
            database: infra.database,
            redis: infra.redis,
            queue: infra.queue,
            workerRuntime: infra.workerRuntime,
        }));
        workerObservabilityHttp = await startWorkerObservabilityHttp({
            workerObservability: config.workerObservability,
            serverPort: config.server.port,
            readiness,
            metrics: infra.metrics,
            metricsEnabled: config.observability.metricsEnabled,
            logger: infra.logger,
        });
        infra.retentionCleanupScheduler.start();
        catalogSyncReconciliationScheduler.start();
        poolMetricsTimer = setInterval(() => {
            infra.database.reportPoolMetrics();
        }, 5_000);
    }
    catch (error) {
        if (poolMetricsTimer !== undefined) {
            clearInterval(poolMetricsTimer);
        }
        await disposeInfrastructureResources({
            workerObservabilityHttp,
            retentionCleanupScheduler: infra.retentionCleanupScheduler,
            catalogSyncReconciliationScheduler,
            workerRuntime: infra.workerRuntime,
            queue: infra.queue,
            redis: infra.redis,
            database: infra.database,
            tracing: infra.tracing,
        }, { logger: infra.logger });
        throw error;
    }
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
    // Force exit so open handles from a partial start cannot keep the process alive.
    process.exit(1);
});
