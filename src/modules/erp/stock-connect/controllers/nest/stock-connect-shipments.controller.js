import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { orderIdParamsSchema } from '../../../../orders/views/order.schemas.js';
import {
  stockConnectCreateShipmentBodySchema,
  stockConnectShipShipmentBodySchema,
  stockConnectShipmentIdParamsSchema,
} from '../../views/stock-connect.schemas.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

/** StockConnect Integration — shipments */
export @Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectShipmentsController {
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  @Post('/api/v2/stock-connect/orders/:orderId/shipments')
  @HttpCode(200)
  async createForOrder(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(stockConnectCreateShipmentBodySchema, body, 'create shipment');
    return this.stockConnectIntegrationService.createShipment(orderId, parsed, idempotencyKey);
  }

  @Get('/api/v2/stock-connect/shipments/:shipmentId')
  async getById(@Param() params) {
    const { shipmentId } = parseOrThrow(stockConnectShipmentIdParamsSchema, params, 'shipment params');
    return this.stockConnectIntegrationService.getShipment(shipmentId);
  }

  @Post('/api/v2/stock-connect/shipments/:shipmentId/ship')
  @HttpCode(200)
  async ship(@Param() params, @Body() body) {
    const { shipmentId } = parseOrThrow(stockConnectShipmentIdParamsSchema, params, 'shipment params');
    const parsed = parseOrThrow(stockConnectShipShipmentBodySchema, body ?? {}, 'ship shipment');
    return this.stockConnectIntegrationService.shipShipment(shipmentId, parsed);
  }
}
