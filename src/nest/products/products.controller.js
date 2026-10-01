import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createProductBodySchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  productLocaleParamsSchema,
  updateProductBodySchema,
  upsertProductContentBodySchema,
} from '../../modules/products/presentation/product.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { ProductsService } from './products.service.js';

export @Controller()
class ProductsController {
  constructor(@Inject(ProductsService) productsService) {
    this.productsService = productsService;
  }

  @Get('/api/v1/products')
  async list(@Query() query) {
    const parsed = listProductsQuerySchema.parse(query);
    const data = await this.productsService.listProducts(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/products')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createProductBodySchema, body, 'create product');
    const data = await this.productsService.createProduct(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/products/:productId')
  async getById(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const data = await this.productsService.getProduct(productId);
    return { success: true, data };
  }

  @Patch('/api/v1/products/:productId')
  @HttpCode(200)
  async update(@Param() params, @Body() body) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(updateProductBodySchema, body, 'update product');
    const data = await this.productsService.updateProduct(productId, parsed);
    return { success: true, data };
  }

  @Post('/api/v1/products/:productId/deactivate')
  @HttpCode(200)
  async deactivate(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const data = await this.productsService.deactivateProduct(productId);
    return { success: true, data };
  }

  @Post('/api/v1/products/:productId/archive')
  @HttpCode(200)
  async archive(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const data = await this.productsService.archiveProduct(productId);
    return { success: true, data };
  }

  @Get('/api/v1/products/:productId/content')
  async listContent(@Param() params) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const data = await this.productsService.getProductContent(productId);
    return { success: true, data };
  }

  @Put('/api/v1/products/:productId/content/:locale')
  @HttpCode(200)
  async upsertContent(@Param() params, @Body() body) {
    const parsedParams = parseOrThrow(productLocaleParamsSchema, params, 'product locale params');
    const parsedBody = parseOrThrow(upsertProductContentBodySchema, body, 'upsert product content');
    const data = await this.productsService.upsertProductContent(
      parsedParams.productId,
      parsedParams.locale,
      parsedBody,
    );
    return { success: true, data };
  }
}
