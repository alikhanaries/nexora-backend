import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';

@Module({
  controllers: [PricingController],
  providers: [],
})
class PricingModule {}
export { PricingModule };
