import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { WASL_CONFIG } from './config/config.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter({ logger: false }));

  const config = app.get(WASL_CONFIG);
  const port = resolveNestPort(config);
  const host = config.server.host;

  await app.listen(port, host);
  process.stdout.write(
    `Deprecated root nest stub listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port} — use src/nest/bootstrap.mjs (npm run start:nest)\n`,
  );
}

function resolveNestPort(config) {
  const fromEnv = process.env.NEST_SERVER_PORT?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return Number(fromEnv);
  }
  return config.server.port;
}

bootstrap().catch((error) => {
  process.stderr.write(`${JSON.stringify({ msg: 'Nest bootstrap failed', err: String(error) })}\n`);
  process.exitCode = 1;
});
