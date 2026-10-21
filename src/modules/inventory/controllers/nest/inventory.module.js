import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';

export @Module({
  controllers: [InventoryController],
  providers: [],
})
class InventoryModule {}
