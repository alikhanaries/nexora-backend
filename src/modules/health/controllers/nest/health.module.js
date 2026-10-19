import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

export @Module({
  controllers: [HealthController],
})
class HealthModule {}
