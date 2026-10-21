import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  stockConnectListOrdersQuerySchema,
  stockConnectOrderIdParamsSchema,
  stockConnectSyncOrdersQuerySchema,
} from '../../views/stock-connect.schemas.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** StockConnect Integration — orders */
export @Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectOrdersController {
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  @Get('/api/v2/stock-connect/orders')
  async list(@Query() query) {
    const parsed = parseOrThrow(stockConnectListOrdersQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.listOrders(parsed);
  }

  @Get('/api/v2/stock-connect/orders/sync')
  async sync(@Query() query) {
    const parsed = parseOrThrow(stockConnectSyncOrdersQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.syncOrders(parsed);
  }

  @Get('/api/v2/stock-connect/orders/:orderId')
  async getById(@Param() params) {
    const { orderId } = parseOrThrow(stockConnectOrderIdParamsSchema, params, 'order params');
    return this.stockConnectIntegrationService.getOrder(orderId);
  }

  @Post('/api/v2/stock-connect/orders/:orderId/cancel')
  @HttpCode(200)
  async cancel(@Param() params, @Headers('idempotency-key') idempotencyKey) {
    const { orderId } = parseOrThrow(stockConnectOrderIdParamsSchema, params, 'order params');
    return this.stockConnectIntegrationService.cancelOrder(orderId, idempotencyKey);
  }
}
