import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createPriceBodySchema,
  listPricesQuerySchema,
  priceIdParamsSchema,
  updatePriceBodySchema,
} from '../../modules/pricing/presentation/price.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { PricingService } from './pricing.service.js';

export @Controller()
class PricingController {
  constructor(@Inject(PricingService) pricingService) {
    this.pricingService = pricingService;
  }

  @Get('/api/v1/prices')
  async list(@Query() query) {
    const parsed = listPricesQuerySchema.parse(query);
    const data = await this.pricingService.listPrices(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/prices')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createPriceBodySchema, body, 'create price');
    const data = await this.pricingService.createPrice(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/prices/:priceId')
  async getById(@Param() params) {
    const { priceId } = parseOrThrow(priceIdParamsSchema, params, 'price params');
    const data = await this.pricingService.getPrice(priceId);
    return { success: true, data };
  }

  @Patch('/api/v1/prices/:priceId')
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { priceId } = parseOrThrow(priceIdParamsSchema, params, 'price params');
    const parsed = parseOrThrow(updatePriceBodySchema, body, 'update price');
    const data = await this.pricingService.patchPrice(priceId, parsed);
    return { success: true, data };
  }
}
