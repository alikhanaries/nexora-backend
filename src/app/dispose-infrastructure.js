import { toErrorMessage } from '../shared/errors/index.js';

/**
 * Best-effort close of infrastructure resources after a failed startup (or a
 * partial {@link createInfrastructure} attempt).
 *
 * Order mirrors {@link gracefulShutdown}: stop consumers before closing the
 * shared queue Redis connection, then cache Redis, then Postgres, then tracing.
 * Step failures are logged and swallowed so one stuck close cannot block the rest.
 *
 * @param {object} [resources]
 * @param {{ logger?: { warn?: Function } }} [options]
 */
export async function disposeInfrastructureResources(resources = {}, options = {}) {
    const logger = options.logger;
    const closeQuietly = async (label, step) => {
        if (typeof step !== 'function') {
            return;
        }
        try {
            await step();
        }
        catch (error) {
            logger?.warn?.(
                { step: label, reason: toErrorMessage(error) },
                'Infrastructure dispose step failed',
            );
        }
    };

    await closeQuietly('http.close', () => resources.httpServer?.close?.());
    await closeQuietly('workerObservabilityHttp.close', () => resources.workerObservabilityHttp?.close?.());
    await closeQuietly('outbox.stop', () => resources.outboxPublisher?.stop?.());
    await closeQuietly('retention.stop', () => resources.retentionCleanupScheduler?.stop?.());
    await closeQuietly('catalogSyncReconciliation.stop', () => resources.catalogSyncReconciliationScheduler?.stop?.());
    await closeQuietly('workers.close', () => resources.workerRuntime?.close?.());
    await closeQuietly('queue.close', () => resources.queue?.close?.());
    // Queue.close() quits the BullMQ Redis client; only quit the raw connection
    // when the queue wrapper was never constructed.
    if (resources.queue === undefined || resources.queue === null) {
        await closeQuietly('queueConnection.quit', async () => {
            const connection = resources.queueConnection;
            if (connection === undefined || connection === null) {
                return;
            }
            if (typeof connection.quit === 'function') {
                await connection.quit().catch(() => connection.disconnect?.());
                return;
            }
            connection.disconnect?.();
        });
    }
    await closeQuietly('redis.close', () => resources.redis?.close?.());
    await closeQuietly('postgres.close', () => resources.database?.close?.());
    await closeQuietly('tracing.shutdown', () => resources.tracing?.shutdown?.());
}
