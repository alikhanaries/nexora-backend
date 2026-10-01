import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { createChannelOrderBodySchema } from '../../modules/compatibility/presentation/compatibility-channel-order.schemas.js';
import { acknowledgeOrderBodySchema } from '../../modules/compatibility/presentation/compatibility-acknowledge.schemas.js';
import {
  listNewOrdersQuerySchema,
  listOrdersQuerySchema,
} from '../../modules/compatibility/presentation/compatibility-order.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../common/filters/compatibility-exception.filter.js';
import { LegacyOrdersService } from './legacy-orders.service.js';

export @Controller()
@UseFilters(CompatibilityExceptionFilter)
class LegacyOrdersV2Controller {
  constructor(@Inject(LegacyOrdersService) legacyOrdersService) {
    this.legacyOrdersService = legacyOrdersService;
  }

  @Get('/api/v2/orders')
  async list(@Query() query) {
    const parsed = listOrdersQuerySchema.parse(query);
    return this.legacyOrdersService.listOrdersV2(parsed);
  }

  @Get('/api/v2/orders/new')
  async listNew(@Query() query) {
    const parsed = listNewOrdersQuerySchema.parse(query);
    return this.legacyOrdersService.listNewOrdersV2(parsed);
  }

  @Post('/api/v2/orders')
  @HttpCode(201)
  async create(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(createChannelOrderBodySchema, body, 'create channel order');
    return this.legacyOrdersService.createChannelOrderV2(parsed, idempotencyKey, channelReference);
  }

  @Post('/api/v2/orders/channel-fulfilled')
  @HttpCode(201)
  async createChannelFulfilled(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(createChannelOrderBodySchema, body, 'create channel fulfilled order');
    return this.legacyOrdersService.createChannelFulfilledOrderV2(
      parsed,
      idempotencyKey,
      channelReference,
    );
  }

  @Post('/api/v2/orders/acknowledge')
  @HttpCode(201)
  async acknowledge(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeOrderBodySchema, body, 'acknowledge order');
    return this.legacyOrdersService.acknowledgeOrderV2(parsed, idempotencyKey);
  }
}
