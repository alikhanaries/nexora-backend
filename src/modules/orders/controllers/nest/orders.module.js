import { Module } from '@nestjs/common';
import { CancellationsModule } from '../../../../modules/cancellations/public/nest-cancellations-module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

export @Module({
  imports: [CancellationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
class OrdersModule {}
