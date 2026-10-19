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
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { z } from 'zod';
import {
  createCancellationBodySchema,
} from '../../modules/compatibility/presentation/compatibility-cancellation.schemas.js';
import {
  acknowledgeReturnBodySchema,
  createReturnBodySchema,
  receiveReturnBodySchema,
} from '../../modules/compatibility/presentation/compatibility-return.schemas.js';
import {
  createShipmentBodySchema,
  merchantShipmentNoParamsSchema,
} from '../../modules/compatibility/presentation/compatibility-shipment.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../common/filters/compatibility-exception.filter.js';
import { LegacyCompatibilityService } from './legacy-compatibility.service.js';

const compatV2OrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  apikey: z.string().optional(),
});

const compatV2ApiKeyQuerySchema = z.object({
  apiKey: z.string().optional(),
  apikey: z.string().optional(),
});

const compatV2ProductsQuerySchema = compatV2ApiKeyQuerySchema.extend({
  merchantProductNoList: z.union([z.string(), z.array(z.string())]).optional(),
  MerchantProductNoList: z.union([z.string(), z.array(z.string())]).optional(),
});

const compatV2IntegrationProductsQuerySchema = compatV2ApiKeyQuerySchema.extend({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(250).optional(),
});

const ceChannelIdParamsSchema = z.object({
  channelId: z.coerce.number().int().positive(),
});

const ceRecordArrayBodySchema = z.array(z.record(z.unknown()));
const ceBulkDeleteBodySchema = z.array(z.union([z.string(), z.number()]));

const ceDeliveryStateBodySchema = z
  .object({
    Status: z.string().min(1),
    DeliveredAt: z.union([z.string(), z.number(), z.null()]).optional(),
  })
  .passthrough();

export @Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatV2Controller {
  constructor(@Inject(LegacyCompatibilityService) legacyCompatibilityService) {
    this.legacyCompatibilityService = legacyCompatibilityService;
  }

  @Post('/api/v2/ce/cancellations')
  @HttpCode(201)
  async createCancellation(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.legacyCompatibilityService.createCancellationForCompatV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/ce/shipments')
  @HttpCode(201)
  async createShipment(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.legacyCompatibilityService.createShipmentForCompatV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/ce/shipments/merchant')
  async listMerchantShipments(@Query() query) {
    const parsed = compatV2OrdersQuerySchema.parse(query);
    return this.legacyCompatibilityService.listMerchantShipmentsForCompatV2(parsed);
  }

  @Get('/api/v2/ce/returns')
  async listReturns(@Query() query) {
    const parsed = compatV2OrdersQuerySchema.parse(query);
    return this.legacyCompatibilityService.listReturnsForCompatV2(parsed);
  }

  @Post('/api/v2/ce/returns/merchant')
  @HttpCode(201)
  async createReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.legacyCompatibilityService.createReturnForCompatV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/ce/returns/merchant/acknowledge')
  @HttpCode(200)
  async acknowledgeReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeReturnBodySchema, body, 'acknowledge return');
    return this.legacyCompatibilityService.acknowledgeReturnForCompatV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/ce/returns')
  async receiveReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(receiveReturnBodySchema, body, 'receive return');
    return this.legacyCompatibilityService.receiveReturnForCompatV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/ce/products')
  async listProducts(@Query() query) {
    const parsed = compatV2ProductsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listProductsForCompatV2(parsed);
  }

  @Get('/api/v2/ce/channels/:channelId/products')
  async listChannelProducts(@Param() params, @Query() query) {
    const { channelId } = parseOrThrow(ceChannelIdParamsSchema, params, 'channel id');
    const parsedQuery = compatV2IntegrationProductsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listIntegrationProductsForCompatV2(channelId, parsedQuery);
  }

  @Get('/api/v2/ce/channels')
  async listCommerceIntegrations() {
    return this.legacyCompatibilityService.listIntegrationsForCompatV2();
  }

  @Post('/api/v2/ce/products')
  @HttpCode(200)
  async pushProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'push products');
    return this.legacyCompatibilityService.pushProductsForCompatV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/ce/offer/stock')
  @HttpCode(200)
  async updateOfferStock(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'update offer stock');
    return this.legacyCompatibilityService.updateOfferStockForCompatV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/ce/offer')
  @HttpCode(200)
  async updateOfferPrice(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'update offer price');
    return this.legacyCompatibilityService.updateOfferPriceForCompatV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/ce/products/freeze')
  @HttpCode(200)
  async freezeProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'freeze products');
    return this.legacyCompatibilityService.freezeProductsForCompatV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/ce/products/bulkdelete')
  @HttpCode(200)
  async bulkDeleteProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceBulkDeleteBodySchema, body, 'bulk delete products');
    return this.legacyCompatibilityService.bulkDeleteProductsForCompatV2(parsed, idempotencyKey);
  }

  @Patch('/api/v2/ce/products/extra-data/bulk')
  @HttpCode(200)
  async patchExtraData(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'patch extra data');
    return this.legacyCompatibilityService.patchExtraDataForCompatV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/ce/shipments/:merchantShipmentNo/delivery-state')
  async updateDeliveryState(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { merchantShipmentNo } = parseOrThrow(
      merchantShipmentNoParamsSchema,
      params,
      'merchant shipment number',
    );
    const parsed = parseOrThrow(ceDeliveryStateBodySchema, body, 'update delivery state');
    return this.legacyCompatibilityService.updateShipmentDeliveryStateForCompatV2(
      merchantShipmentNo,
      parsed,
      idempotencyKey,
    );
  }
}
