import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller.js';

export @Module({
  controllers: [MarketplacesController],
  providers: [],
})
class MarketplacesModule {}
