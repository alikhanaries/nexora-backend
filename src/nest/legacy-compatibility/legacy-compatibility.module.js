import { Module } from '@nestjs/common';
import { LegacyOrdersModule } from '../legacy-orders/legacy-orders.module.js';
import { ChannelEngineCompatibilityController } from './channel-engine-compatibility.controller.js';
import { CompatibilityV2Controller } from './compatibility-v2.controller.js';
import { LegacyCompatibilityService } from './legacy-compatibility.service.js';

export @Module({
  imports: [LegacyOrdersModule],
  controllers: [CompatibilityV2Controller, ChannelEngineCompatibilityController],
  providers: [LegacyCompatibilityService],
})
class LegacyCompatibilityModule {}
