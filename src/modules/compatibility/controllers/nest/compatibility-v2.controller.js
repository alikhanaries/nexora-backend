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
} from '../../views/compatibility-cancellation.schemas.js';
import {
  listProductsByMerchantSkuQuerySchema,
  merchantProductNoListBodySchema,
  patchExtraDataBulkBodySchema,
  postProductsBodySchema,
  putOfferBodySchema,
  putOfferStockBodySchema,
} from '../../views/compatibility-catalog.schemas.js';
import {
  acknowledgeReturnBodySchema,
  createReturnBodySchema,
  listMerchantReturnsQuerySchema,
  listNewMerchantReturnsQuerySchema,
  merchantOrderNoParamsSchema,
  receiveReturnBodySchema,
} from '../../views/compatibility-return.schemas.js';
import {
  createShipmentBodySchema,
  listMerchantShipmentsQuerySchema,
  merchantShipmentNoParamsSchema,
  updateShipmentTrackingBodySchema,
} from '../../views/compatibility-shipment.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../../../../app/common/filters/compatibility-exception.filter.js';
import { CompatibilityHttpService } from './compatibility-http.service.js';

@Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatibilityV2Controller {
  constructor(@Inject(CompatibilityHttpService) compatibilityHttpService) {
    this.compatibilityHttpService = compatibilityHttpService;
  }

  @Get('/api/v2/foundation/ping')
  async ping() {
    return this.compatibilityHttpService.pingV2();
  }

  @Get('/api/v2/shipments/merchant')
  async listMerchantShipments(@Query() query) {
    const parsed = parseOrThrow(listMerchantShipmentsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantShipmentsV2(parsed);
  }

  @Post('/api/v2/shipments')
  @HttpCode(201)
  async createShipment(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.compatibilityHttpService.createShipmentV2(parsed, idempotencyKey);
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
    return this.compatibilityHttpService.updateShipmentTrackingV2(
      merchantShipmentNo,
      parsed,
      idempotencyKey,
    );
  }

  @Get('/api/v2/cancellations/merchant')
  async listMerchantCancellations(@Query() query) {
    const parsed = parseOrThrow(listMerchantCancellationsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantCancellationsV2(parsed);
  }

  @Post('/api/v2/cancellations')
  @HttpCode(201)
  async createCancellation(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.compatibilityHttpService.createCancellationV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/returns/merchant/new')
  async listNewMerchantReturns(@Query() query) {
    const parsed = parseOrThrow(listNewMerchantReturnsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listNewMerchantReturnsV2(parsed);
  }

  @Get('/api/v2/returns/merchant/:merchantOrderNo')
  async listReturnsByMerchantOrderNo(@Param() params) {
    const { merchantOrderNo } = parseOrThrow(
      merchantOrderNoParamsSchema,
      params,
      'merchant order number',
    );
    return this.compatibilityHttpService.listReturnsByMerchantOrderNoV2(merchantOrderNo);
  }

  @Get('/api/v2/returns/merchant')
  async listMerchantReturns(@Query() query) {
    const parsed = parseOrThrow(listMerchantReturnsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantReturnsV2(parsed);
  }

  @Put('/api/v2/returns')
  async receiveReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(receiveReturnBodySchema, body, 'receive return');
    return this.compatibilityHttpService.receiveReturnV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/returns/merchant/acknowledge')
  @HttpCode(200)
  async acknowledgeReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeReturnBodySchema, body, 'acknowledge return');
    return this.compatibilityHttpService.acknowledgeReturnV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/returns')
  @HttpCode(201)
  async createReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.compatibilityHttpService.createReturnV2(parsed, idempotencyKey);
  }

  @Get('/api/v2/products')
  async listProducts(@Query() query) {
    const parsed = parseOrThrow(listProductsByMerchantSkuQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listProductsV2(parsed);
  }

  @Post('/api/v2/products')
  @HttpCode(200)
  async upsertProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(postProductsBodySchema, body, 'upsert products');
    return this.compatibilityHttpService.upsertProductsV2(parsed, idempotencyKey);
  }

  @Post('/api/v2/products/freeze')
  @HttpCode(200)
  async freezeProducts(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(merchantProductNoListBodySchema, body, 'freeze products');
    return this.compatibilityHttpService.freezeProductsV2(parsed, idempotencyKey, channelReference);
  }

  @Post('/api/v2/products/bulkdelete')
  @HttpCode(200)
  async bulkDeleteProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(merchantProductNoListBodySchema, body, 'bulk delete products');
    return this.compatibilityHttpService.bulkDeleteProductsV2(parsed, idempotencyKey);
  }

  @Patch('/api/v2/products/extra-data/bulk')
  @HttpCode(200)
  async patchExtraDataBulk(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(patchExtraDataBulkBodySchema, body, 'patch extra data');
    return this.compatibilityHttpService.patchExtraDataBulkV2(parsed, idempotencyKey);
  }

  @Put('/api/v2/offer')
  @HttpCode(200)
  async updateOfferPrice(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(putOfferBodySchema, body, 'update offer price');
    return this.compatibilityHttpService.updateOfferPriceV2(parsed, idempotencyKey, channelReference);
  }

  @Put('/api/v2/offer/stock')
  @HttpCode(200)
  async updateOfferStock(
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
    @Headers('x-channel-reference') channelReference,
  ) {
    const parsed = parseOrThrow(putOfferStockBodySchema, body, 'update offer stock');
    return this.compatibilityHttpService.updateOfferStockV2(parsed, idempotencyKey, channelReference);
  }
}
export { CompatibilityV2Controller };
