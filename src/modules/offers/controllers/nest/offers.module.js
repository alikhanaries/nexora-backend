/**
 * Nest module for sellable offer lifecycle APIs.
 * Registers OffersController; handlers delegate to CORE_SERVICES.offers use cases.
 */
import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller.js';

@Module({
  controllers: [OffersController],
  providers: [],
})
class OffersModule {}
export { OffersModule };
