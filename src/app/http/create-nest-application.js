/**
 * Builds the Nest application on a pre-configured Express instance and {@link buildAppModule}.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { buildAppModule } from '../app.module.js';
import { configureExpress } from './configure-express.js';
import { WASL_CONFIG } from '../config/wasl-config.module.js';
import { NestLoggerService } from '../common/nest-logger.service.js';

/**
 * @param {ReturnType<import('../config/index.js').loadConfigFromEnvironment>} config
 * @param {{ logger: object, metrics: object, database: object | null, readiness?: object }} infra
 * @param {object | null} [coreServices]
 * @param {{ readiness?: object }} [options]
 */
export async function createNestApplication(config, infra, coreServices = null, options = {}) {
  const expressApp = express();
  configureExpress(expressApp, config, infra.metrics);

  const AppModule = buildAppModule(
    { ...infra, readiness: options.readiness ?? infra.readiness },
    coreServices,
  );

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
  return nestApp.get(WASL_CONFIG);
}

/** Listen port override via `NEST_SERVER_PORT`, otherwise `config.server.port`. */
export function resolveNestListenPort(config) {
  const fromEnv = process.env.NEST_SERVER_PORT?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return Number(fromEnv);
  }
  return config.server.port;
}
