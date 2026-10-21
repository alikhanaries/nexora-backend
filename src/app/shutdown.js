/**
 * Ordered teardown for API and worker processes (HTTP, queues, Redis, Postgres, tracing).
 */

/** Runs shutdown steps with per-step timeouts and marks readiness not-ready first. */
export async function gracefulShutdown(targets) {
    const { logger, timeoutMs } = targets;
    logger.info({}, 'Graceful shutdown started');
    targets.readiness?.markNotReady();
    const deadline = Date.now() + timeoutMs;
    /** Runs one shutdown step, logging success or a warn on failure without aborting later steps. */
    const runStep = async (name, step) => {
        try {
            await step();
            logger.info({ step: name }, 'Shutdown step completed');
        }
        catch (error) {
            logger.warn({ step: name, reason: error instanceof Error ? error.message : 'unknown' }, 'Shutdown step failed');
        }
    };
    if (targets.httpServer !== undefined) {
        await runStep('http.close', async () => {
            await withTimeout(targets.httpServer.close(), remaining(deadline), 'http.close');
        });
    }
    if (targets.workerObservabilityHttp !== undefined) {
        await runStep('workerObservabilityHttp.close', async () => {
            await withTimeout(targets.workerObservabilityHttp.close(), remaining(deadline), 'workerObservabilityHttp.close');
        });
    }
    if (targets.outboxPublisher !== undefined) {
        await runStep('outbox.stop', () => targets.outboxPublisher.stop());
    }
    if (targets.retentionCleanupScheduler !== undefined) {
        await runStep('retention.stop', () => targets.retentionCleanupScheduler.stop());
    }
    if (targets.catalogSyncReconciliationScheduler !== undefined) {
        await runStep('catalogSyncReconciliation.stop', () => targets.catalogSyncReconciliationScheduler.stop());
    }
    if (targets.workerRuntime !== undefined) {
        await runStep('workers.close', () => targets.workerRuntime.close());
    }
    if (targets.queue !== undefined) {
        await runStep('queue.close', () => targets.queue.close());
    }
    if (targets.redis !== undefined) {
        await runStep('redis.close', () => targets.redis.close());
    }
    if (targets.database !== undefined) {
        await runStep('postgres.close', () => targets.database.close());
    }
    if (targets.tracing !== undefined) {
        await runStep('tracing.flush', () => targets.tracing.shutdown());
    }
    await targets.logger.flush();
    logger.info({}, 'Graceful shutdown finished');
}
/** Milliseconds left until the global shutdown deadline (never negative). */
function remaining(deadline) {
    return Math.max(0, deadline - Date.now());
}
/** Races `promise` against a timer; rejects when time budget is exhausted. */
async function withTimeout(promise, timeoutMs, label) {
    if (timeoutMs <= 0) {
        throw new Error(`${label} timed out during shutdown`);
    }
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`${label} timed out during shutdown`));
                }, timeoutMs);
            }),
        ]);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
