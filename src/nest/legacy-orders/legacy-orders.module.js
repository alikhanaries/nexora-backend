import { Module } from '@nestjs/common';
import { CompatV2OrdersController } from './compat-v2-orders.controller.js';
import { LegacyOrdersService } from './legacy-orders.service.js';
import { LegacyOrdersV2Controller } from './legacy-orders-v2.controller.js';

export @Module({
  controllers: [LegacyOrdersV2Controller, CompatV2OrdersController],
  providers: [LegacyOrdersService],
  exports: [LegacyOrdersService],
})
class LegacyOrdersModule {}
