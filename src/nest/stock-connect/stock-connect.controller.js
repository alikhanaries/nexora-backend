import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { parseOrThrow } from '../../shared/validation/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { stockConnectOk } from './stock-connect.envelope.js';
import {
  stockConnectCancelOrderBodySchema,
  stockConnectCreateShipmentBodySchema,
  stockConnectInventoryAdjustBodySchema,
  stockConnectListQuerySchema,
  stockConnectOrdersQuerySchema,
  stockConnectOrdersSyncQuerySchema,
  stockConnectProductCreateBodySchema,
  stockConnectProductPatchBodySchema,
  stockConnectPublishBodySchema,
  stockConnectShipShipmentBodySchema,
} from './stock-connect.schemas.js';
import { StockConnectService } from './stock-connect.service.js';

export @Controller()
class StockConnectController {
  constructor(@Inject(StockConnectService) stockConnectService) {
    this.stockConnectService = stockConnectService;
  }

  @Public()
  @Get('/api/v2/stock-connect/ping')
  ping() {
    return stockConnectOk({ message: 'pong' });
  }

  @Get('/api/v2/stock-connect/channels')
  async listChannels() {
    const data = await this.stockConnectService.listChannels();
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/products')
  async listProducts(@Query() query) {
    const parsed = stockConnectListQuerySchema.parse(query);
    const data = await this.stockConnectService.listProducts(parsed);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/products')
  @HttpCode(201)
  async createProduct(@Body() body) {
    const parsed = parseOrThrow(stockConnectProductCreateBodySchema, body, 'create product');
    const data = await this.stockConnectService.createProduct(parsed);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/products/:productId')
  async getProduct(@Param('productId') productId) {
    const data = await this.stockConnectService.getProduct(productId);
    return stockConnectOk(data);
  }

  @Patch('/api/v2/stock-connect/products/:productId')
  async patchProduct(@Param('productId') productId, @Body() body) {
    const parsed = parseOrThrow(stockConnectProductPatchBodySchema, body, 'patch product');
    const data = await this.stockConnectService.patchProduct(productId, parsed);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/products/:productId/publish')
  @HttpCode(200)
  async publishProduct(@Param('productId') productId, @Body() body) {
    const parsed = parseOrThrow(stockConnectPublishBodySchema, body, 'publish product');
    const data = await this.stockConnectService.publishProduct(productId, parsed);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/inventory/:productId')
  async getInventory(@Param('productId') productId) {
    const data = await this.stockConnectService.getInventory(productId);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/inventory/adjustments')
  @HttpCode(200)
  async adjustInventory(@Body() body) {
    const parsed = parseOrThrow(
      stockConnectInventoryAdjustBodySchema,
      body,
      'inventory adjustment',
    );
    const data = await this.stockConnectService.adjustInventory(parsed);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/orders')
  async listOrders(@Query() query) {
    const parsed = stockConnectOrdersQuerySchema.parse(query);
    const data = await this.stockConnectService.listOrders(parsed);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/orders/sync')
  async syncOrders(@Query() query) {
    const parsed = stockConnectOrdersSyncQuerySchema.parse(query);
    const data = await this.stockConnectService.syncOrders(parsed);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/orders/:orderId')
  async getOrder(@Param('orderId') orderId) {
    const data = await this.stockConnectService.getOrder(orderId);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/orders/:orderId/cancel')
  @HttpCode(200)
  async cancelOrder(@Param('orderId') orderId, @Body() body = {}) {
    const parsed = parseOrThrow(stockConnectCancelOrderBodySchema, body ?? {}, 'cancel order');
    const data = await this.stockConnectService.cancelOrder(orderId, parsed);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/orders/:orderId/shipments')
  @HttpCode(201)
  async createShipment(
    @Param('orderId') orderId,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const parsed = parseOrThrow(stockConnectCreateShipmentBodySchema, body, 'create shipment');
    const data = await this.stockConnectService.createShipment(orderId, parsed, idempotencyKey);
    return stockConnectOk(data);
  }

  @Get('/api/v2/stock-connect/shipments/:shipmentId')
  async getShipment(@Param('shipmentId') shipmentId) {
    const data = await this.stockConnectService.getShipment(shipmentId);
    return stockConnectOk(data);
  }

  @Post('/api/v2/stock-connect/shipments/:shipmentId/ship')
  @HttpCode(200)
  async shipShipment(@Param('shipmentId') shipmentId, @Body() body = {}) {
    const parsed = parseOrThrow(stockConnectShipShipmentBodySchema, body ?? {}, 'ship shipment');
    const data = await this.stockConnectService.shipShipment(shipmentId, parsed);
    return stockConnectOk(data);
  }
}
