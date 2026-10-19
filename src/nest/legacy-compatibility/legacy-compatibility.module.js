import { Module } from '@nestjs/common';
import { LegacyOrdersModule } from '../legacy-orders/legacy-orders.module.js';
import { CompatV2Controller } from './compat-v2.controller.js';
import { CompatibilityV2Controller } from './compatibility-v2.controller.js';
import { LegacyCompatibilityService } from './legacy-compatibility.service.js';

export @Module({
  imports: [LegacyOrdersModule],
  controllers: [CompatibilityV2Controller, CompatV2Controller],
  providers: [LegacyCompatibilityService],
})
class LegacyCompatibilityModule {}
