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
import {
  createCancellationBodySchema,
  listMerchantCancellationsQuerySchema,
} from '../../modules/compatibility/presentation/compatibility-cancellation.schemas.js';
import {
  listProductsByMerchantSkuQuerySchema,
  merchantProductNoListBodySchema,
  patchExtraDataBulkBodySchema,
  postProductsBodySchema,
  putOfferBodySchema,
  putOfferStockBodySchema,
} from '../../modules/compatibility/presentation/compatibility-catalog.schemas.js';
import {
  acknowledgeReturnBodySchema,
  createReturnBodySchema,
  listMerchantReturnsQuerySchema,
  listNewMerchantReturnsQuerySchema,
  merchantOrderNoParamsSchema,
  receiveReturnBodySchema,
} from '../../modules/compatibility/presentation/compatibility-return.schemas.js';
import {
  createShipmentBodySchema,
  listMerchantShipmentsQuerySchema,
  merchantShipmentNoParamsSchema,
  updateShipmentTrackingBodySchema,
} from '../../modules/compatibility/presentation/compatibility-shipment.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../common/filters/compatibility-exception.filter.js';
import { LegacyCompatibilityService } from './legacy-compatibility.service.js';

export @Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatibilityV2Controller {
  constructor(@Inject(LegacyCompatibilityService) legacyCompatibilityService) {
    this.legacyCompatibilityService = legacyCompatibilityService;
  }

  @Get('/api/v2/foundation/ping')
  async ping() {
    return this.legacyCompatibilityService.pingV2();
  }

  @Get('/api/v2/shipments/merchant')
  async listMerchantShipments(@Query() query) {
    const parsed = listMerchantShipmentsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listMerchantShipmentsV2(parsed);
  }

  @Post('/api/v2/shipments')
  @HttpCode(201)
  async createShipment(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.legacyCompatibilityService.createShipmentV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/shipments/:merchantShipmentNo')
  async updateShipmentTracking(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { merchantShipmentNo } = parseOrThrow(
      merchantShipmentNoParamsSchema,
      params,
      'merchant shipment number',
    );
    const parsed = parseOrThrow(updateShipmentTrackingBodySchema, body, 'update shipment tracking');
    return this.legacyCompatibilityService.updateShipmentTrackingV2(
      merchantShipmentNo,
      parsed,
      idempotencyKey,
    );
  }

  @Get('/api/v2/cancellations/merchant')
  async listMerchantCancellations(@Query() query) {
    const parsed = listMerchantCancellationsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listMerchantCancellationsV2(parsed);
  }

  @Post('/api/v2/cancellations')
  @HttpCode(201)
  async createCancellation(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.legacyCompatibilityService.createCancellationV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/returns/merchant/new')
  async listNewMerchantReturns(@Query() query) {
    const parsed = listNewMerchantReturnsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listNewMerchantReturnsV2(parsed);
  }

  @Get('/api/v2/returns/merchant/:merchantOrderNo')
  async listReturnsByMerchantOrderNo(@Param() params) {
    const { merchantOrderNo } = parseOrThrow(
      merchantOrderNoParamsSchema,
      params,
      'merchant order number',
    );
    return this.legacyCompatibilityService.listReturnsByMerchantOrderNoV2(merchantOrderNo);
  }

  @Get('/api/v2/returns/merchant')
  async listMerchantReturns(@Query() query) {
    const parsed = listMerchantReturnsQuerySchema.parse(query);
    return this.legacyCompatibilityService.listMerchantReturnsV2(parsed);
  }

  @Put('/api/v2/returns')
  async receiveReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(receiveReturnBodySchema, body, 'receive return');
    return this.legacyCompatibilityService.receiveReturnV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/returns/merchant/acknowledge')
  async acknowledgeReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeReturnBodySchema, body, 'acknowledge return');
    return this.legacyCompatibilityService.acknowledgeReturnV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/returns')
  @HttpCode(201)
  async createReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.legacyCompatibilityService.createReturnV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/products')
  async listProducts(@Query() query) {
    const parsed = listProductsByMerchantSkuQuerySchema.parse(query);
    return this.legacyCompatibilityService.listProductsV2(parsed);
  }

  @Post('/api/v2/products')
  async upsertProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(postProductsBodySchema, body, 'upsert products');
    return this.legacyCompatibilityService.upsertProductsV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/products/freeze')
  async freezeProducts(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(merchantProductNoListBodySchema, body, 'freeze products');
    return this.legacyCompatibilityService.freezeProductsV2(parsed, idempotencyKey, channelReference);
  }

  @Post('/api/v2/products/bulkdelete')
  async bulkDeleteProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(merchantProductNoListBodySchema, body, 'bulk delete products');
    return this.legacyCompatibilityService.bulkDeleteProductsV2(parsed, idempotencyKey);
  }

  @Patch('/api/v2/products/extra-data/bulk')
  async patchExtraDataBulk(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(patchExtraDataBulkBodySchema, body, 'patch extra data');
    return this.legacyCompatibilityService.patchExtraDataBulkV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/offer')
  async updateOfferPrice(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(putOfferBodySchema, body, 'update offer price');
    return this.legacyCompatibilityService.updateOfferPriceV2(parsed, idempotencyKey, channelReference);
  }

  @Put('/api/v2/offer/stock')
  async updateOfferStock(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(putOfferStockBodySchema, body, 'update offer stock');
    return this.legacyCompatibilityService.updateOfferStockV2(parsed, idempotencyKey, channelReference);
  }
}
