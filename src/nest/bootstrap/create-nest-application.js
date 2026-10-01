import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { buildAppModule } from '../app.module.js';
import { configureExpress } from './configure-express.js';
import { NEXORA_CONFIG } from '../config/config.module.js';
import { NestLoggerService } from '../common/nest-logger.service.js';

/**
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 * @param {object | null} [coreDomain]
 */
export async function createNestApplication(config, infra, coreDomain = null) {
  const expressApp = express();
  configureExpress(expressApp, config);

  const AppModule = buildAppModule(infra, coreDomain);

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: false,
    bodyParser: false,
  });

  nestApp.useLogger(new NestLoggerService(infra.logger));
  nestApp.enableShutdownHooks();
  return nestApp;
}

/**
 * @param {import('@nestjs/common').INestApplication} nestApp
 */
export function getNestConfig(nestApp) {
  return nestApp.get(NEXORA_CONFIG);
}

export function resolveNestListenPort(config) {
  const fromEnv = process.env.NEST_SERVER_PORT?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return Number(fromEnv);
  }
  let port = 3001;
  if (port === config.server.port) {
    port = config.server.port + 1;
  }
  return port;
}
