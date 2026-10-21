import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  stockConnectAdjustInventoryBodySchema,
  stockConnectInventoryQuerySchema,
  stockConnectProductIdParamsSchema,
} from '../../views/stock-connect.schemas.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** StockConnect Integration — inventory */
export @Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectInventoryController {
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  @Get('/api/v2/stock-connect/inventory/:productId')
  async getForProduct(@Param() params, @Query() query) {
    const { productId } = parseOrThrow(stockConnectProductIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(stockConnectInventoryQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.getProductInventory(productId, parsed);
  }

  @Post('/api/v2/stock-connect/inventory/adjustments')
  @HttpCode(200)
  async adjust(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(stockConnectAdjustInventoryBodySchema, body, 'adjust inventory');
    return this.stockConnectIntegrationService.adjustInventory(parsed, idempotencyKey);
  }
}
