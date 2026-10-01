import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { NexoraConfigModule } from './config/config.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 */
export function buildAppModule(infra) {
  @Module({
    imports: [NexoraConfigModule, DatabaseModule.register(infra), HealthModule],
    providers: [
      {
        provide: APP_FILTER,
        useClass: GlobalExceptionFilter,
      },
    ],
  })
  class AppModule {}

  return AppModule;
}
