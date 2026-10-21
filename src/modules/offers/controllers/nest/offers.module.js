import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller.js';

export @Module({
  controllers: [OffersController],
  providers: [],
})
class OffersModule {}
