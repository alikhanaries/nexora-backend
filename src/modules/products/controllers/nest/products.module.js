import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';

export @Module({
  controllers: [ProductsController],
  providers: [],
})
class ProductsModule {}
