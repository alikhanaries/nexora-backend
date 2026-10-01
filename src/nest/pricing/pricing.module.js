import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

export @Module({
  controllers: [PricingController],
  providers: [PricingService],
})
class PricingModule {}
