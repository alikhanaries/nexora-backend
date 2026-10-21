/**
 * Nest module for stock locations and inventory movement APIs.
 * Registers InventoryController; use cases supplied via CORE_SERVICES.inventory.
 */
import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';

@Module({
  controllers: [InventoryController],
  providers: [],
})
class InventoryModule {}
export { InventoryModule };
