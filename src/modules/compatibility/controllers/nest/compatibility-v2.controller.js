/**
 * Nest adapter for merchant compatibility v2 APIs (`/api/v2/*`, excluding `/ce`).
 * Handlers delegate to CompatibilityHttpService; business rules stay in compatibility services and routeDeps.
 */
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

/** Merchant-facing v2 catalog, fulfillment, and returns routes under `/api/v2/*`. */
@Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatibilityV2Controller {
  /** @param {CompatibilityHttpService} compatibilityHttpService Delegates to routeDeps with rate limits. */
  constructor(@Inject(CompatibilityHttpService) compatibilityHttpService) {
    this.compatibilityHttpService = compatibilityHttpService;
  }

  /** GET `/api/v2/foundation/ping` — liveness probe; read rate limit only, no tenant data mutation. */
  @Get('/api/v2/foundation/ping')
  async ping() {
    return this.compatibilityHttpService.pingV2();
  }

  /**
   * GET `/api/v2/shipments/merchant` — filtered merchant shipment page (merchant compatibility v2 query schema).
   * @param {object} query Pagination and shipment filter fields.
   * @returns {Promise<object>} Shipment collection with external integer IDs.
   */
  @Get('/api/v2/shipments/merchant')
  async listMerchantShipments(@Query() query) {
    const parsed = parseOrThrow(listMerchantShipmentsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantShipmentsV2(parsed);
  }

  /**
   * POST `/api/v2/shipments` — creates shipment; requires explicit idempotency key (merchant v2 path).
   * @param {object} body Shipment create payload.
   * @param {string | string[] | undefined} idempotencyKey Required mutation idempotency header.
   * @returns {Promise<object>} Shipment create envelope.
   */
  @Post('/api/v2/shipments')
  @HttpCode(201)
  async createShipment(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.compatibilityHttpService.createShipmentV2(parsed, idempotencyKey);
  }

  /**
   * PUT `/api/v2/shipments/:merchantShipmentNo` — updates carrier tracking on an existing shipment.
   * @param {object} params Merchant shipment number.
   * @param {object} body Tracking fields.
   * @param {string | string[] | undefined} idempotencyKey Idempotency header.
   * @returns {Promise<object>} Update result.
   */
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

  /** GET `/api/v2/cancellations/merchant` — lists cancellations with date and reference filters. */
  @Get('/api/v2/cancellations/merchant')
  async listMerchantCancellations(@Query() query) {
    const parsed = parseOrThrow(listMerchantCancellationsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantCancellationsV2(parsed);
  }

  /** POST `/api/v2/cancellations` — creates cancellation with required idempotency key. */
  @Post('/api/v2/cancellations')
  @HttpCode(201)
  async createCancellation(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.compatibilityHttpService.createCancellationV2(parsed, idempotencyKey);
  }

  /** GET `/api/v2/returns/merchant/new` — returns awaiting merchant action (status filter preset). */
  @Get('/api/v2/returns/merchant/new')
  async listNewMerchantReturns(@Query() query) {
    const parsed = parseOrThrow(listNewMerchantReturnsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listNewMerchantReturnsV2(parsed);
  }

  /** GET `/api/v2/returns/merchant/:merchantOrderNo` — returns tied to one merchant order number. */
  @Get('/api/v2/returns/merchant/:merchantOrderNo')
  async listReturnsByMerchantOrderNo(@Param() params) {
    const { merchantOrderNo } = parseOrThrow(
      merchantOrderNoParamsSchema,
      params,
      'merchant order number',
    );
    return this.compatibilityHttpService.listReturnsByMerchantOrderNoV2(merchantOrderNo);
  }

  /** GET `/api/v2/returns/merchant` — paginated return search with status and date filters. */
  @Get('/api/v2/returns/merchant')
  async listMerchantReturns(@Query() query) {
    const parsed = parseOrThrow(listMerchantReturnsQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listMerchantReturnsV2(parsed);
  }

  /** PUT `/api/v2/returns` — warehouse receive return mutation (idempotent). */
  @Put('/api/v2/returns')
  async receiveReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(receiveReturnBodySchema, body, 'receive return');
    return this.compatibilityHttpService.receiveReturnV2(parsed, idempotencyKey);
  }

  /** POST `/api/v2/returns/merchant/acknowledge` — merchant acknowledges return request. */
  @Post('/api/v2/returns/merchant/acknowledge')
  @HttpCode(200)
  async acknowledgeReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeReturnBodySchema, body, 'acknowledge return');
    return this.compatibilityHttpService.acknowledgeReturnV2(parsed, idempotencyKey);
  }

  /** POST `/api/v2/returns` — creates merchant return against an order. */
  @Post('/api/v2/returns')
  @HttpCode(201)
  async createReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.compatibilityHttpService.createReturnV2(parsed, idempotencyKey);
  }

  /** GET `/api/v2/products` — product lookup by merchant SKU list (required query list). */
  @Get('/api/v2/products')
  async listProducts(@Query() query) {
    const parsed = parseOrThrow(listProductsByMerchantSkuQuerySchema, query, 'list query');
    return this.compatibilityHttpService.listProductsV2(parsed);
  }

  /** POST `/api/v2/products` — upserts catalog products via catalogCompatibilityCommand + idempotency store. */
  @Post('/api/v2/products')
  @HttpCode(200)
  async upsertProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(postProductsBodySchema, body, 'upsert products');
    return this.compatibilityHttpService.upsertProductsV2(parsed, idempotencyKey);
  }

  /**
   * POST `/api/v2/products/freeze` — freeze SKUs; optional `x-channel-reference` scopes offer suspend.
   * @param {string | string[] | undefined} channelReference Integration reference header for channel resolution.
   */
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

  /** POST `/api/v2/products/bulkdelete` — deactivates products by merchant SKU list. */
  @Post('/api/v2/products/bulkdelete')
  @HttpCode(200)
  async bulkDeleteProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(merchantProductNoListBodySchema, body, 'bulk delete products');
    return this.compatibilityHttpService.bulkDeleteProductsV2(parsed, idempotencyKey);
  }

  /** PATCH `/api/v2/products/extra-data/bulk` — merges product extra-data attributes. */
  @Patch('/api/v2/products/extra-data/bulk')
  @HttpCode(200)
  async patchExtraDataBulk(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(patchExtraDataBulkBodySchema, body, 'patch extra data');
    return this.compatibilityHttpService.patchExtraDataBulkV2(parsed, idempotencyKey);
  }

  /** PUT `/api/v2/offer` — channel-scoped price update; uses api key channel + optional `x-channel-reference`. */
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

  /** PUT `/api/v2/offer/stock` — sets absolute stock per offer line with inventory adjust deltas. */
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
