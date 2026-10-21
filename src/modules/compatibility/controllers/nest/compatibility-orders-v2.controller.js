/**
 * Nest adapter for compatibility v2 order ingestion and polling.
 * Serves `/api/v2/orders*`; delegates to CompatibilityOrdersService (`CORE_SERVICES.compatibility.routeDeps`).
 */
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

/** Order list/new/create/channel-fulfilled/acknowledge under `/api/v2/orders*`. */
@Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatibilityOrdersV2Controller {
  /** @param {CompatibilityOrdersService} compatibilityOrdersService Order routeDeps adapter. */
  constructor(@Inject(CompatibilityOrdersService) compatibilityOrdersService) {
    this.compatibilityOrdersService = compatibilityOrdersService;
  }

  /** GET `/api/v2/orders` — paginated order poll with external status and date filters. */
  @Get('/api/v2/orders')
  async list(@Query() query) {
    const parsed = parseOrThrow(listOrdersQuerySchema, query, 'list query');
    return this.compatibilityOrdersService.listOrdersV2(parsed);
  }

  /** GET `/api/v2/orders/new` — orders in NEW status only (merchant poll shortcut). */
  @Get('/api/v2/orders/new')
  async listNew(@Query() query) {
    const parsed = parseOrThrow(listNewOrdersQuerySchema, query, 'list query');
    return this.compatibilityOrdersService.listNewOrdersV2(parsed);
  }

  /**
   * POST `/api/v2/orders` — ingests integration channel order; resolves channel via api key + `x-channel-reference`.
   * Idempotency required; may create orders and external integer id mappings on first success.
   */
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

  /**
   * POST `/api/v2/orders/channel-fulfilled` — creates pre-fulfilled channel order (shipped/delivered path).
   * Same idempotency and channel resolution as standard create; different core command fingerprint.
   */
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

  /** POST `/api/v2/orders/acknowledge` — merchant acknowledges orders (explicit idempotency key). */
  @Post('/api/v2/orders/acknowledge')
  @HttpCode(201)
  async acknowledge(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeOrderBodySchema, body, 'acknowledge order');
    return this.compatibilityOrdersService.acknowledgeOrderV2(parsed, idempotencyKey);
  }
}
export { CompatibilityOrdersV2Controller };
