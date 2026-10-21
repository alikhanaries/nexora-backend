import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller.js';

export @Module({
  controllers: [ShipmentsController],
  providers: [],
})
class ShipmentsModule {}
