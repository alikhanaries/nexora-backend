import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { buildAppModule } from '../../../src/nest/app.module.js';
import { configureExpress } from '../../../src/nest/bootstrap/configure-express.js';
import { loadConfigFromEnvironment } from '../../../src/app/config/index.js';
import { createPinoLogger } from '../../../src/infrastructure/observability/pino-logger.js';
import { noopMetricsRecorder } from '../../../src/shared/metrics/index.js';

/**
 * @param {{ extraControllers?: unknown[], connectDatabase?: boolean }} [options]
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

  const AppModule = buildAppModule(infra);

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
