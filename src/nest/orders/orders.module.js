import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

export @Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
class OrdersModule {}
