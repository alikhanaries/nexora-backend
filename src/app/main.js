import { loadConfigFromEnvironment } from './config/index.js';
import { createApplication } from './bootstrap/create-application.js';
import { createInfrastructure } from './bootstrap/create-infrastructure.js';
import { gracefulShutdown } from './bootstrap/shutdown.js';
import { describeErrorForLog } from '../shared/errors/index.js';
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
    infra.logger.info({ host: config.server.host, port: config.server.port }, 'API server started');
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
    process.exitCode = 1;
});
