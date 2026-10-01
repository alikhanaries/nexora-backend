import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller.js';
import { MarketplacesService } from './marketplaces.service.js';

export @Module({
  controllers: [MarketplacesController],
  providers: [MarketplacesService],
})
class MarketplacesModule {}
