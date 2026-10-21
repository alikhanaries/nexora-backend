/**
 * Nest adapter for StockConnect inventory read/adjust APIs.
 * Routes under `/api/v2/stock-connect/inventory*`; delegates to StockConnectIntegrationService.
 */
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  stockConnectAdjustInventoryBodySchema,
  stockConnectInventoryQuerySchema,
  stockConnectProductIdParamsSchema,
} from '../../views/stock-connect.schemas.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectInventoryController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Returns inventory balances for a product, optionally filtered by stock location. */
  @Get('/api/v2/stock-connect/inventory/:productId')
  async getForProduct(@Param() params, @Query() query) {
    const { productId } = parseOrThrow(stockConnectProductIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(stockConnectInventoryQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.getProductInventory(productId, parsed);
  }

  /** Applies a quantity delta at a stock location; requires `idempotency-key`. */
  @Post('/api/v2/stock-connect/inventory/adjustments')
  @HttpCode(200)
  async adjust(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(stockConnectAdjustInventoryBodySchema, body, 'adjust inventory');
    return this.stockConnectIntegrationService.adjustInventory(parsed, idempotencyKey);
  }
}
export { StockConnectInventoryController };
