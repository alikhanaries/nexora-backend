/**
 * Nest module for marketplace catalog configuration APIs.
 * Registers MarketplacesController wired to CORE_SERVICES.marketplaces use cases.
 */
import { Module } from '@nestjs/common';
import { MarketplacesController } from './marketplaces.controller.js';

@Module({
  controllers: [MarketplacesController],
  providers: [],
})
class MarketplacesModule {}
export { MarketplacesModule };
