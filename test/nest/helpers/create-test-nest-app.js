import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../../../src/nest/app.module.js';
import { configureExpress } from '../../../src/nest/bootstrap/configure-express.js';
import { loadConfigFromEnvironment } from '../../../src/app/config/index.js';

/**
 * @param {{ extraControllers?: unknown[] }} [options]
 */
export async function createTestNestApp(options = {}) {
  const config = loadConfigFromEnvironment();
  const expressApp = express();
  configureExpress(expressApp, config);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.extraControllers ?? [],
  }).compile();

  const app = moduleRef.createNestApplication(new ExpressAdapter(expressApp), {
    bodyParser: false,
  });
  await app.init();
  return { app, config, expressApp };
}
