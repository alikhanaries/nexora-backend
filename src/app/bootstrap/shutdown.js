export async function gracefulShutdown(targets) {
    const { logger, timeoutMs } = targets;
    logger.info({}, 'Graceful shutdown started');
    targets.readiness?.markNotReady();
    const deadline = Date.now() + timeoutMs;
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
    if (targets.outboxPublisher !== undefined) {
        await runStep('outbox.stop', () => targets.outboxPublisher.stop());
    }
    if (targets.retentionCleanupScheduler !== undefined) {
        await runStep('retention.stop', () => targets.retentionCleanupScheduler.stop());
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
function remaining(deadline) {
    return Math.max(0, deadline - Date.now());
}
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
