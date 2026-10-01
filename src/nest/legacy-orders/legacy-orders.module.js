import { Module } from '@nestjs/common';
import { ChannelEngineOrdersController } from './channel-engine-orders.controller.js';
import { LegacyOrdersService } from './legacy-orders.service.js';
import { LegacyOrdersV2Controller } from './legacy-orders-v2.controller.js';

export @Module({
  controllers: [LegacyOrdersV2Controller, ChannelEngineOrdersController],
  providers: [LegacyOrdersService],
  exports: [LegacyOrdersService],
})
class LegacyOrdersModule {}
