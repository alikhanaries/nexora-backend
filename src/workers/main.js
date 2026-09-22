import { loadConfigFromEnvironment } from '../app/config/index.js';
import { createInfrastructure } from '../app/bootstrap/create-infrastructure.js';
import { gracefulShutdown } from '../app/bootstrap/shutdown.js';
import { AesSecretEncryptor } from '../infrastructure/auth/aes-secret-encryptor.js';
import { createWebhookDeliveryService, createWebhookDispatchService } from '../modules/webhooks/index.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import { createIntegrationEventConsumers } from './create-integration-event-consumers.js';
import { registerWorkerHandlers } from './handlers/queue-job-handlers.js';
async function main() {
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config);
    const webhookDispatchService = createWebhookDispatchService({
        database: infra.database,
        queue: infra.queue,
    });
    const webhookDeliveryService = createWebhookDeliveryService({
        database: infra.database,
        outbox: infra.outbox,
        httpClient: infra.httpClient,
        secretEncryptor: new AesSecretEncryptor(config.auth.mfaEncryptionKey),
        logger: infra.logger,
        metrics: infra.metrics,
        config,
    });
    const { integrationEventRouter } = createIntegrationEventConsumers({
        database: infra.database,
        inbox: infra.inbox,
        logger: infra.logger,
        webhookDispatchService,
    });
    registerWorkerHandlers({
        workerRuntime: infra.workerRuntime,
        integrationEventRouter,
        webhookDeliveryService,
    });
    infra.retentionCleanupScheduler.start();
    infra.logger.info({}, 'Worker started');
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        infra.logger.info({ signal }, 'Worker shutdown signal received');
        await gracefulShutdown({
            workerRuntime: infra.workerRuntime,
            retentionCleanupScheduler: infra.retentionCleanupScheduler,
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
