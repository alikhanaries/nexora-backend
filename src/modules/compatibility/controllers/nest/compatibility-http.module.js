/**
 * Nest module for compatibility v2 and CE catalog/fulfillment HTTP surfaces.
 * Wires CompatibilityV2Controller, CompatV2Controller, and CompatibilityHttpService; imports order routes module.
 */
import { Module } from '@nestjs/common';
import { CompatibilityOrdersModule } from './compatibility-orders.module.js';
import { CompatV2Controller } from './compat-v2.controller.js';
import { CompatibilityV2Controller } from './compatibility-v2.controller.js';
import { CompatibilityHttpService } from './compatibility-http.service.js';

@Module({
  imports: [CompatibilityOrdersModule],
  controllers: [CompatibilityV2Controller, CompatV2Controller],
  providers: [CompatibilityHttpService],
})
class CompatibilityHttpModule {}
export { CompatibilityHttpModule };
