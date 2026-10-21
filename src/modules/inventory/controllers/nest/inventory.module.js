import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';

@Module({
  controllers: [InventoryController],
  providers: [],
})
class InventoryModule {}
export { InventoryModule };
