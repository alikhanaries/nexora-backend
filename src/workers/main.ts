import { loadConfigFromEnvironment } from '../app/config/index.js';
import { createInfrastructure } from '../app/bootstrap/create-infrastructure.js';
import { gracefulShutdown } from '../app/bootstrap/shutdown.js';
import { InboxConsumer } from '../infrastructure/postgres/inbox-consumer.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import { LoggingIntegrationEventHandler } from './handlers/integration-event.handler.js';
import { registerWorkerHandlers } from './handlers/queue-job-handlers.js';

async function main(): Promise<void> {
  const config = loadConfigFromEnvironment();
  const infra = await createInfrastructure(config);

  const handler = new LoggingIntegrationEventHandler(infra.logger);
  const inboxConsumer = new InboxConsumer(infra.database, infra.inbox, handler, infra.logger);
  registerWorkerHandlers({
    workerRuntime: infra.workerRuntime,
    inboxConsumer,
    handler,
  });

  infra.logger.info({}, 'Worker started');

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    infra.logger.info({ signal }, 'Worker shutdown signal received');

    await gracefulShutdown({
      workerRuntime: infra.workerRuntime,
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

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ msg: 'Worker startup failed', err: describeErrorForLog(error) })}\n`,
  );
  process.exitCode = 1;
});
