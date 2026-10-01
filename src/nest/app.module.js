import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { NexoraConfigModule } from './config/config.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { CoreDomainModule } from './domain/core-domain.module.js';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { TenantsModule } from './tenants/tenants.module.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 * @param {object | null} [coreDomain]
 */
export function buildAppModule(infra, coreDomain = null) {
  const imports = [NexoraConfigModule, DatabaseModule.register(infra), HealthModule];
  const providers = [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ];

  if (coreDomain !== null) {
    imports.push(CoreDomainModule.register(coreDomain), AuthModule, TenantsModule);
    providers.push({
      provide: APP_GUARD,
      useClass: AuthGuard,
    });
  }

  @Module({
    imports,
    providers,
  })
  class AppModule {}

  return AppModule;
}
