import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';

@Module({
  controllers: [OrdersController],
  providers: [],
})
class OrdersModule {}
export { OrdersModule };
