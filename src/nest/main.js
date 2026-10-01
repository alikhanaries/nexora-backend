import { loadConfigFromEnvironment } from '../app/config/index.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import { NEST_READINESS } from './health/readiness.provider.js';
import { createNestInfrastructure } from './bootstrap/create-nest-infrastructure.js';
import { wireCoreDomain } from './bootstrap/wire-core-domain.js';
import {
  createNestApplication,
  resolveNestListenPort,
} from './bootstrap/create-nest-application.js';
async function bootstrap() {
  const config = loadConfigFromEnvironment();
  const nestPort = resolveNestListenPort(config);

  const infra = await createNestInfrastructure(config);
  let coreDomain = null;
  if (infra.database !== null) {
    coreDomain = await wireCoreDomain(config, infra.database, {
      rateLimiter: infra.rateLimiter,
      metrics: infra.metrics,
      logger: infra.logger,
      idempotency: infra.idempotency,
      queue: infra.queue,
    });
  }
  const app = await createNestApplication(config, infra, coreDomain);
  const host = config.server.host;

  await app.listen(nestPort, host);

  infra.logger.info(
    { host, port: nestPort, postgres: infra.database !== null },
    'Nexora Nest (Express) listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    infra.logger.info({ signal }, 'Nest shutdown signal received');

    try {
      const readiness = app.get(NEST_READINESS);
      readiness.markNotReady();
    } catch {
      // ignore
    }

    if (infra.queue !== null && infra.queue !== undefined) {
      await infra.queue.close().catch(() => {});
    }
    if (infra.redis !== null) {
      await infra.redis.close();
    }
    if (infra.database !== null) {
      await infra.database.close();
    }

    await app.close();

    await infra.logger.flush();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

bootstrap().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ msg: 'Nest bootstrap failed', err: describeErrorForLog(error) })}\n`,
  );
  process.exitCode = 1;
});
