import { loadConfigFromEnvironment } from '../app/config/index.js';
import { describeErrorForLog } from '../shared/errors/index.js';
import {
  createNestApplication,
  resolveNestListenPort,
} from './bootstrap/create-nest-application.js';

async function bootstrap() {
  const config = loadConfigFromEnvironment();
  const nestPort = resolveNestListenPort(config);

  const app = await createNestApplication(config);
  const host = config.server.host;

  await app.listen(nestPort, host);

  process.stdout.write(
    `Nexora Nest (Express, Phase 2) listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${nestPort}\n`,
  );

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdout.write(`${JSON.stringify({ msg: 'Nest shutdown signal received', signal })}\n`);
    await app.close();
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
