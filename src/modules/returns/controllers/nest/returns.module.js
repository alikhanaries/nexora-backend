/**
 * Nest module for return merchandise authorization (RMA) APIs.
 * Registers ReturnsController wired to CORE_SERVICES.returns use cases.
 */
import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';

@Module({
  controllers: [ReturnsController],
  providers: [],
})
class ReturnsModule {}
export { ReturnsModule };
