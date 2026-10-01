import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { orderIdParamsSchema } from '../../modules/orders/presentation/order.schemas.js';
import {
  createShipmentBodySchema,
  listShipmentsQuerySchema,
  shipmentIdParamsSchema,
  shipShipmentBodySchema,
} from '../../modules/shipments/presentation/shipment.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { ShipmentsService } from './shipments.service.js';

export @Controller()
class ShipmentsController {
  constructor(@Inject(ShipmentsService) shipmentsService) {
    this.shipmentsService = shipmentsService;
  }

  @Post('/api/v1/orders/:orderId/shipments')
  @HttpCode(201)
  async createForOrder(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.shipmentsService.createShipment(orderId, parsed, idempotencyKey);
  }

  @Get('/api/v1/shipments')
  async list(@Query() query) {
    const parsed = listShipmentsQuerySchema.parse(query);
    const data = await this.shipmentsService.listShipments(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/shipments/:shipmentId')
  async getById(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const data = await this.shipmentsService.getShipment(shipmentId);
    return { success: true, data };
  }

  @Post('/api/v1/shipments/:shipmentId/ship')
  @HttpCode(200)
  async ship(@Param() params, @Body() body) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const parsed = parseOrThrow(shipShipmentBodySchema, body ?? {}, 'ship shipment');
    const data = await this.shipmentsService.shipShipment(shipmentId, parsed);
    return { success: true, data };
  }

  @Post('/api/v1/shipments/:shipmentId/deliver')
  @HttpCode(200)
  async deliver(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const data = await this.shipmentsService.deliverShipment(shipmentId);
    return { success: true, data };
  }

  @Post('/api/v1/shipments/:shipmentId/cancel')
  @HttpCode(200)
  async cancel(@Param() params) {
    const { shipmentId } = parseOrThrow(shipmentIdParamsSchema, params, 'shipment params');
    const data = await this.shipmentsService.cancelShipment(shipmentId);
    return { success: true, data };
  }
}
