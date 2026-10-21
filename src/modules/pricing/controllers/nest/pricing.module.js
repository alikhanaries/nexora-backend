import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';

export @Module({
  controllers: [PricingController],
  providers: [],
})
class PricingModule {}
