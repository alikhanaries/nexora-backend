/**
 * Nest module for product master data and content APIs.
 * Registers ProductsController; use cases come from CORE_SERVICES.products.
 */
import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';

@Module({
  controllers: [ProductsController],
  providers: [],
})
class ProductsModule {}
export { ProductsModule };
