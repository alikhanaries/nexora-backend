/**
 * Nest module for first-party order APIs.
 * Registers OrdersController; use cases are supplied app-wide via CORE_SERVICES.
 */
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';

@Module({
  controllers: [OrdersController],
  providers: [],
})
class OrdersModule {}
export { OrdersModule };
