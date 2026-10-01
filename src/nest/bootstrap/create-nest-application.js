import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../app.module.js';
import { configureExpress } from './configure-express.js';
import { NEXORA_CONFIG } from '../config/config.module.js';

/**
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 */
export async function createNestApplication(config) {
  const expressApp = express();
  configureExpress(expressApp, config);

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  nestApp.enableShutdownHooks();
  return nestApp;
}

/**
 * Load config from Nest DI after the app is created (same object as legacy).
 *
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
