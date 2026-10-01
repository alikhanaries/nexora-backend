import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createMarketplaceBodySchema,
  listMarketplacesQuerySchema,
  marketplaceIdParamsSchema,
  updateMarketplaceBodySchema,
} from '../../modules/marketplaces/presentation/marketplace.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { MarketplacesService } from './marketplaces.service.js';

export @Controller()
class MarketplacesController {
  constructor(@Inject(MarketplacesService) marketplacesService) {
    this.marketplacesService = marketplacesService;
  }

  @Get('/api/v1/marketplaces')
  async list(@Query() query) {
    const parsed = listMarketplacesQuerySchema.parse(query);
    const data = await this.marketplacesService.listMarketplaces(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/marketplaces')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createMarketplaceBodySchema, body, 'create marketplace');
    const data = await this.marketplacesService.createMarketplace(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/marketplaces/:id')
  async getById(@Param() params) {
    const { id } = parseOrThrow(marketplaceIdParamsSchema, params, 'marketplace params');
    const data = await this.marketplacesService.getMarketplace(id);
    return { success: true, data };
  }

  @Patch('/api/v1/marketplaces/:id')
  @HttpCode(200)
  async patch(@Param() params, @Body() body) {
    const { id } = parseOrThrow(marketplaceIdParamsSchema, params, 'marketplace params');
    const parsed = parseOrThrow(updateMarketplaceBodySchema, body, 'update marketplace');
    const data = await this.marketplacesService.patchMarketplace(id, parsed);
    return { success: true, data };
  }
}
