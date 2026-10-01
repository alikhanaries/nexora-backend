import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller.js';
import { ShipmentsService } from './shipments.service.js';

export @Module({
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
})
class ShipmentsModule {}
