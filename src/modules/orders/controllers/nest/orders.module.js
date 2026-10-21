import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';

export @Module({
  controllers: [OrdersController],
  providers: [],
})
class OrdersModule {}
