import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

export @Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
class InventoryModule {}
