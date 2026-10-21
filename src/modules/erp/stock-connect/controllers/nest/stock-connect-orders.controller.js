/**
 * Nest adapter for StockConnect order sync and lifecycle.
 * Routes under `/api/v2/stock-connect/orders*`; delegates to StockConnectIntegrationService.
 */
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

@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectOrdersController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Paginated order list with optional filters (status, channel, dates, references). */
  @Get('/api/v2/stock-connect/orders')
  async list(@Query() query) {
    const parsed = parseOrThrow(stockConnectListOrdersQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.listOrders(parsed);
  }

  /** Poll-style order export; response includes the applied update window. */
  @Get('/api/v2/stock-connect/orders/sync')
  async sync(@Query() query) {
    const parsed = parseOrThrow(stockConnectSyncOrdersQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.syncOrders(parsed);
  }

  /** Order detail by internal id. */
  @Get('/api/v2/stock-connect/orders/:orderId')
  async getById(@Param() params) {
    const { orderId } = parseOrThrow(stockConnectOrderIdParamsSchema, params, 'order params');
    return this.stockConnectIntegrationService.getOrder(orderId);
  }

  /** Cancels an order; requires `idempotency-key`. */
  @Post('/api/v2/stock-connect/orders/:orderId/cancel')
  @HttpCode(200)
  async cancel(@Param() params, @Headers('idempotency-key') idempotencyKey) {
    const { orderId } = parseOrThrow(stockConnectOrderIdParamsSchema, params, 'order params');
    return this.stockConnectIntegrationService.cancelOrder(orderId, idempotencyKey);
  }
}
export { StockConnectOrdersController };
