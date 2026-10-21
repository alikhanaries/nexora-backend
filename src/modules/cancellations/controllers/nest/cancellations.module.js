/**
 * Nest module for standalone cancellation resources.
 * Registers CancellationsController; domain logic stays in cancellations use cases via CORE_SERVICES.
 */
import { Module } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller.js';

@Module({
  controllers: [CancellationsController],
  providers: [],
})
class CancellationsModule {}
export { CancellationsModule };
