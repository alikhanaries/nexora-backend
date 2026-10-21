/**
 * Nest module for shipment fulfillment APIs.
 * Registers ShipmentsController; domain work delegated via CORE_SERVICES.shipments use cases.
 */
import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller.js';

@Module({
  controllers: [ShipmentsController],
  providers: [],
})
class ShipmentsModule {}
export { ShipmentsModule };
