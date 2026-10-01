import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

export @Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
class ProductsModule {}
