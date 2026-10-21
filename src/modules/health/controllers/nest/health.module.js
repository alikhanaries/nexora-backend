/**
 * Nest module for liveness/readiness and foundation probe routes.
 * Registers HealthController; NEST_READINESS is provided at application root.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
class HealthModule {}
export { HealthModule };
