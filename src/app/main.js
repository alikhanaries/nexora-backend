import { loadConfigFromEnvironment } from './config/index.js';
import { createApplication } from './create-application.js';
import { createInfrastructure } from './create-infrastructure.js';
import { disposeInfrastructureResources } from './dispose-infrastructure.js';
import { gracefulShutdown } from './shutdown.js';
import { describeErrorForLog } from '../shared/errors/index.js';
async function main() {
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config);
    /** @type {Awaited<ReturnType<typeof createApplication>> | undefined} */
    let app;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let poolMetricsTimer;
    try {
        app = await createApplication(infra);
        infra.outboxPublisher.start();
        poolMetricsTimer = setInterval(() => {
            infra.database.reportPoolMetrics();
        }, 5_000);
        await app.httpServer.listen({
            host: config.server.host,
            port: config.server.port,
        });
    }
    catch (error) {
        if (poolMetricsTimer !== undefined) {
            clearInterval(poolMetricsTimer);
        }
        await disposeInfrastructureResources({
            httpServer: app?.httpServer,
            outboxPublisher: infra.outboxPublisher,
            queue: infra.queue,
            redis: infra.redis,
            database: infra.database,
            tracing: infra.tracing,
        }, { logger: infra.logger });
        throw error;
    }
    infra.logger.info(
        { host: config.server.host, port: config.server.port },
        'Wasl API (NestJS + Express) listening',
    );
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        infra.logger.info({ signal }, 'Shutdown signal received');
        clearInterval(poolMetricsTimer);
        await gracefulShutdown({
            readiness: app.readiness,
            httpServer: app.httpServer,
            outboxPublisher: infra.outboxPublisher,
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
    process.stderr.write(`${JSON.stringify({ msg: 'API startup failed', err: describeErrorForLog(error) })}\n`);
    // Force exit: open handles from a partial start must not keep the process alive
    // after a fatal startup failure (exitCode alone would not exit in that case).
    process.exit(1);
});
