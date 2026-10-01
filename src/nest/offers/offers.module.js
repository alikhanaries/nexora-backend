import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';

export @Module({
  controllers: [OffersController],
  providers: [OffersService],
})
class OffersModule {}
