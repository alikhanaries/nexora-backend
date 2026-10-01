import { Module } from '@nestjs/common';
import { CancellationsModule } from '../cancellations/cancellations.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

export @Module({
  imports: [CancellationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
class OrdersModule {}
