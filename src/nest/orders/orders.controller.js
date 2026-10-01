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
import {
  createOrderBodySchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
} from '../../modules/orders/presentation/order.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { OrdersService } from './orders.service.js';

export @Controller()
class OrdersController {
  constructor(@Inject(OrdersService) ordersService) {
    this.ordersService = ordersService;
  }

  @Post('/api/v1/orders')
  @HttpCode(201)
  async create(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createOrderBodySchema, body, 'create order');
    const data = await this.ordersService.createOrder(parsed, idempotencyKey);
    return data;
  }

  @Get('/api/v1/orders')
  async list(@Query() query) {
    const parsed = listOrdersQuerySchema.parse(query);
    const data = await this.ordersService.listOrders(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/orders/:orderId')
  async getById(@Param() params) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const data = await this.ordersService.getOrder(orderId);
    return { success: true, data };
  }

  @Post('/api/v1/orders/:orderId/confirm')
  @HttpCode(200)
  async confirm(@Param() params) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const data = await this.ordersService.confirmOrder(orderId);
    return { success: true, data };
  }
}
