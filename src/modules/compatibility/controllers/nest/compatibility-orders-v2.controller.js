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
import { createIntegrationOrderBodySchema } from '../../views/compatibility-channel-order.schemas.js';
import { acknowledgeOrderBodySchema } from '../../views/compatibility-acknowledge.schemas.js';
import {
  listNewOrdersQuerySchema,
  listOrdersQuerySchema,
} from '../../views/compatibility-order.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../../../../app/common/filters/compatibility-exception.filter.js';
import { CompatibilityOrdersService } from './compatibility-orders.service.js';

export @Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatibilityOrdersV2Controller {
  constructor(@Inject(CompatibilityOrdersService) compatibilityOrdersService) {
    this.compatibilityOrdersService = compatibilityOrdersService;
  }

  @Get('/api/v2/orders')
  async list(@Query() query) {
    const parsed = listOrdersQuerySchema.parse(query);
    return this.compatibilityOrdersService.listOrdersV2(parsed);
  }

  @Get('/api/v2/orders/new')
  async listNew(@Query() query) {
    const parsed = listNewOrdersQuerySchema.parse(query);
    return this.compatibilityOrdersService.listNewOrdersV2(parsed);
  }

  @Post('/api/v2/orders')
  @HttpCode(201)
  async create(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(createIntegrationOrderBodySchema, body, 'create channel order');
    return this.compatibilityOrdersService.createIntegrationOrderV2(parsed, idempotencyKey, channelReference);
  }

  @Post('/api/v2/orders/channel-fulfilled')
  @HttpCode(201)
  async createCommerceIntegrationFulfilled(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(createIntegrationOrderBodySchema, body, 'create channel fulfilled order');
    return this.compatibilityOrdersService.createIntegrationFulfilledOrderV2(
      parsed,
      idempotencyKey,
      channelReference,
    );
  }

  @Post('/api/v2/orders/acknowledge')
  @HttpCode(201)
  async acknowledge(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeOrderBodySchema, body, 'acknowledge order');
    return this.compatibilityOrdersService.acknowledgeOrderV2(parsed, idempotencyKey);
  }
}
