import { Module } from '@nestjs/common';
import { CompatV2OrdersController } from './compat-v2-orders.controller.js';
import { CompatibilityOrdersService } from './compatibility-orders.service.js';
import { CompatibilityOrdersV2Controller } from './compatibility-orders-v2.controller.js';

@Module({
  controllers: [CompatibilityOrdersV2Controller, CompatV2OrdersController],
  providers: [CompatibilityOrdersService],
  exports: [CompatibilityOrdersService],
})
class CompatibilityOrdersModule {}
export { CompatibilityOrdersModule };
