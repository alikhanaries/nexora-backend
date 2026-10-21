import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller.js';

@Module({
  controllers: [MarketplacesController],
  providers: [],
})
class MarketplacesModule {}
export { MarketplacesModule };
