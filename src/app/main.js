/**
 * API process entrypoint (`npm start` / `npm run dev`).
 *
 * Boot order: env config → shared infrastructure (DB/Redis/queue) →
 * domain composition (`createApplication`) → outbox publisher + pool metrics →
 * Nest HTTP listen. SIGTERM/SIGINT drain via `gracefulShutdown`.
 * The worker process has a separate entry at `src/workers/main.js`.
 */
import { loadConfigFromEnvironment } from './config/index.js';
import { createApplication } from './create-application.js';
import { createInfrastructure } from './create-infrastructure.js';
import { gracefulShutdown } from './shutdown.js';
import { describeErrorForLog } from '../shared/errors/index.js';

/** API boot: infrastructure, application graph, outbox, HTTP listen, and signal-driven graceful shutdown. */
async function main() {
    const config = loadConfigFromEnvironment();
    const infra = await createInfrastructure(config);
    const app = await createApplication(infra);
    infra.outboxPublisher.start();
    const poolMetricsTimer = setInterval(() => {
        infra.database.reportPoolMetrics();
    }, 5_000);
    await app.httpServer.listen({
        host: config.server.host,
        port: config.server.port,
    });
    infra.logger.info(
        { host: config.server.host, port: config.server.port },
        'Wasl API (NestJS + Express) listening',
    );
    let shuttingDown = false;
    /** Idempotent handler for SIGTERM/SIGINT that drains dependencies via {@link gracefulShutdown}. */
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
    process.exitCode = 1;
});
