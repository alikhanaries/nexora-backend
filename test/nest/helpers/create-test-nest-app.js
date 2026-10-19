import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { buildAppModule } from '../../../src/app/app.module.js';
import { configureExpress } from '../../../src/app/http/configure-express.js';
import { loadConfigFromEnvironment } from '../../../src/app/config/index.js';
import { createPinoLogger } from '../../../src/infrastructure/observability/pino-logger.js';
import { noopMetricsRecorder } from '../../../src/shared/metrics/index.js';

/**
 * @param {{ extraControllers?: unknown[], connectDatabase?: boolean, coreServices?: object | null }} [options]
 */
export async function createTestNestApp(options = {}) {
  const config = loadConfigFromEnvironment();
  const expressApp = express();
  configureExpress(expressApp, config);

  const infra = {
    logger: createPinoLogger({ ...config, observability: { ...config.observability, logLevel: 'silent' } }),
    metrics: noopMetricsRecorder,
    database: null,
  };

  const coreServices = options.coreServices ?? null;
  const AppModule = buildAppModule(infra, coreServices);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.extraControllers ?? [],
  }).compile();

  const app = moduleRef.createNestApplication(new ExpressAdapter(expressApp), {
    bodyParser: false,
  });
  await app.init();
  return { app, config, expressApp, infra };
}
