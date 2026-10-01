import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { NEST_READINESS, createNestPhase2Readiness } from './readiness.provider.js';

export @Module({
  controllers: [HealthController],
  providers: [
    {
      provide: NEST_READINESS,
      useFactory: () => createNestPhase2Readiness(),
    },
  ],
})
class HealthModule {}
