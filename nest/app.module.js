import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { NexoraConfigModule } from './config/config.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js';
import { HealthModule } from './health/health.module.js';

export @Module({
  imports: [NexoraConfigModule, HealthModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
class AppModule {
  configure(consumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
