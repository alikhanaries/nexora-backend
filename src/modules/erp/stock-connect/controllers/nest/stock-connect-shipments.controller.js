/**
 * Nest adapter for StockConnect shipment create and status transitions.
 * Routes under `/api/v2/stock-connect/shipments*`; delegates to StockConnectIntegrationService.
 */
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

@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectShipmentsController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Creates a shipment for an order; requires `idempotency-key`. */
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

  /** Shipment detail by id. */
  @Get('/api/v2/stock-connect/shipments/:shipmentId')
  async getById(@Param() params) {
    const { shipmentId } = parseOrThrow(stockConnectShipmentIdParamsSchema, params, 'shipment params');
    return this.stockConnectIntegrationService.getShipment(shipmentId);
  }

  /** Marks a shipment shipped (carrier, service, tracking). */
  @Post('/api/v2/stock-connect/shipments/:shipmentId/ship')
  @HttpCode(200)
  async ship(@Param() params, @Body() body) {
    const { shipmentId } = parseOrThrow(stockConnectShipmentIdParamsSchema, params, 'shipment params');
    const parsed = parseOrThrow(stockConnectShipShipmentBodySchema, body ?? {}, 'ship shipment');
    return this.stockConnectIntegrationService.shipShipment(shipmentId, parsed);
  }
}
export { StockConnectShipmentsController };
