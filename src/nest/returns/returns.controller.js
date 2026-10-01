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
  createReturnBodySchema,
  listReturnsQuerySchema,
  returnIdParamsSchema,
} from '../../modules/returns/presentation/return.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { ReturnsService } from './returns.service.js';

export @Controller()
class ReturnsController {
  constructor(@Inject(ReturnsService) returnsService) {
    this.returnsService = returnsService;
  }

  @Post('/api/v1/orders/:orderId/returns')
  @HttpCode(201)
  async createForOrder(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { orderId } = parseOrThrow(orderIdParamsSchema, params, 'order params');
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.returnsService.createReturn(orderId, parsed, idempotencyKey);
  }

  @Get('/api/v1/returns')
  async list(@Query() query) {
    const parsed = listReturnsQuerySchema.parse(query);
    const data = await this.returnsService.listReturns(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/returns/:returnId')
  async getById(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.getReturn(returnId);
    return { success: true, data };
  }

  @Post('/api/v1/returns/:returnId/approve')
  @HttpCode(200)
  async approve(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.approveReturn(returnId);
    return { success: true, data };
  }

  @Post('/api/v1/returns/:returnId/receive')
  @HttpCode(200)
  async receive(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.receiveReturn(returnId);
    return { success: true, data };
  }

  @Post('/api/v1/returns/:returnId/complete')
  @HttpCode(200)
  async complete(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.completeReturn(returnId);
    return { success: true, data };
  }

  @Post('/api/v1/returns/:returnId/reject')
  @HttpCode(200)
  async reject(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.rejectReturn(returnId);
    return { success: true, data };
  }

  @Post('/api/v1/returns/:returnId/cancel')
  @HttpCode(200)
  async cancel(@Param() params) {
    const { returnId } = parseOrThrow(returnIdParamsSchema, params, 'return params');
    const data = await this.returnsService.cancelReturn(returnId);
    return { success: true, data };
  }
}
