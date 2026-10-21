/**
 * Nest module for price list management APIs.
 * Registers PricingController bound to CORE_SERVICES.pricing use cases.
 */
import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';

@Module({
  controllers: [PricingController],
  providers: [],
})
class PricingModule {}
export { PricingModule };
