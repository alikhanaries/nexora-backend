/**
 * Nest adapter for external compatibility CE catalog and fulfillment APIs (`/api/v2/ce/*`).
 * Handlers validate input and delegate to CompatibilityHttpService (compatibility routeDeps / CORE_SERVICES).
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
import { z } from 'zod';
import {
  createCancellationBodySchema,
} from '../../views/compatibility-cancellation.schemas.js';
import {
  acknowledgeReturnBodySchema,
  createReturnBodySchema,
  receiveReturnBodySchema,
} from '../../views/compatibility-return.schemas.js';
import {
  createShipmentBodySchema,
  merchantShipmentNoParamsSchema,
} from '../../views/compatibility-shipment.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { CompatibilityExceptionFilter } from '../../../../app/common/filters/compatibility-exception.filter.js';
import { CompatibilityHttpService } from './compatibility-http.service.js';

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

/** Broad CE compatibility surface: channels, products, offers, shipments, returns, cancellations under `/api/v2/ce/*`. */
@Controller()
@UseFilters(CompatibilityExceptionFilter)
class CompatV2Controller {
  /** @param {CompatibilityHttpService} compatibilityHttpService Shared `/api/v2/*` and `/api/v2/ce/*` delegation layer. */
  constructor(@Inject(CompatibilityHttpService) compatibilityHttpService) {
    this.compatibilityHttpService = compatibilityHttpService;
  }

  /**
   * POST `/api/v2/ce/cancellations` — creates a merchant cancellation via routeDeps (CE idempotency context).
   * @param {object} body Validated cancellation create body.
   * @param {string | string[] | undefined} idempotencyKey `Idempotency-Key` or derived CE compat key.
   * @returns {Promise<object>} Mutation ApiResponse; tenant-scoped idempotency replay on duplicate keys.
   */
  @Post('/api/v2/ce/cancellations')
  @HttpCode(201)
  async createCancellation(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createCancellationBodySchema, body, 'create cancellation');
    return this.compatibilityHttpService.createCancellationForCompatV2(parsed, idempotencyKey);
  }

  /**
   * POST `/api/v2/ce/shipments` — registers a shipment for tenant orders (mutation rate limit + idempotency).
   * @param {object} body Validated shipment create body.
   * @param {string | string[] | undefined} idempotencyKey Idempotency header for safe retries.
   * @returns {Promise<object>} External shipment result envelope.
   */
  @Post('/api/v2/ce/shipments')
  @HttpCode(201)
  async createShipment(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createShipmentBodySchema, body, 'create shipment');
    return this.compatibilityHttpService.createShipmentForCompatV2(parsed, idempotencyKey);
  }

  /**
   * GET `/api/v2/ce/shipments/merchant` — lists merchant shipments (simplified CE pagination query).
   * @param {object} query Optional `page` / `pageSize`.
   * @returns {Promise<object>} Shipment collection with external integer IDs where mapped.
   */
  @Get('/api/v2/ce/shipments/merchant')
  async listMerchantShipments(@Query() query) {
    const parsed = parseOrThrow(compatV2OrdersQuerySchema, query, 'query');
    return this.compatibilityHttpService.listMerchantShipmentsForCompatV2(parsed);
  }

  /**
   * GET `/api/v2/ce/returns` — paginated return list for the authenticated tenant.
   * @param {object} query Optional `page` / `pageSize`.
   * @returns {Promise<object>} Return ApiResponse with order enrichment and external IDs.
   */
  @Get('/api/v2/ce/returns')
  async listReturns(@Query() query) {
    const parsed = parseOrThrow(compatV2OrdersQuerySchema, query, 'query');
    return this.compatibilityHttpService.listReturnsForCompatV2(parsed);
  }

  /**
   * POST `/api/v2/ce/returns/merchant` — merchant-initiated return create (CE mutation context).
   * @param {object} body Validated return create body.
   * @param {string | string[] | undefined} idempotencyKey Idempotency for duplicate POST protection.
   * @returns {Promise<object>} Return mutation envelope.
   */
  @Post('/api/v2/ce/returns/merchant')
  @HttpCode(201)
  async createReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(createReturnBodySchema, body, 'create return');
    return this.compatibilityHttpService.createReturnForCompatV2(parsed, idempotencyKey);
  }

  /**
   * POST `/api/v2/ce/returns/merchant/acknowledge` — acknowledges pending returns for processing.
   * @param {object} body Acknowledge return payload.
   * @param {string | string[] | undefined} idempotencyKey Idempotency header or derived key.
   * @returns {Promise<object>} Acknowledge result; idempotent replay per tenant + route + key.
   */
  @Post('/api/v2/ce/returns/merchant/acknowledge')
  @HttpCode(200)
  async acknowledgeReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(acknowledgeReturnBodySchema, body, 'acknowledge return');
    return this.compatibilityHttpService.acknowledgeReturnForCompatV2(parsed, idempotencyKey);
  }

  /**
   * PUT `/api/v2/ce/returns` — records received return goods (warehouse receive flow).
   * @param {object} body Validated receive-return body.
   * @param {string | string[] | undefined} idempotencyKey Idempotency for mutation deduplication.
   * @returns {Promise<object>} Receive outcome envelope.
   */
  @Put('/api/v2/ce/returns')
  async receiveReturn(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(receiveReturnBodySchema, body, 'receive return');
    return this.compatibilityHttpService.receiveReturnForCompatV2(parsed, idempotencyKey);
  }

  /**
   * GET `/api/v2/ce/products` — fetches products by merchant SKU list from query string.
   * Requires at least one merchant product number; read rate limit applies.
   * @param {object} query `merchantProductNoList` / legacy PascalCase alias.
   * @returns {Promise<object>} Product content in CE compat shape.
   */
  @Get('/api/v2/ce/products')
  async listProducts(@Query() query) {
    const parsed = parseOrThrow(compatV2ProductsQuerySchema, query, 'query');
    return this.compatibilityHttpService.listProductsForCompatV2(parsed);
  }

  /**
   * GET `/api/v2/ce/channels/:channelId/products` — integration-scoped product page (external integer channel id).
   * @param {object} params Path `channelId` (positive integer external reference when mapped).
   * @param {object} query Pagination `page` / `pageSize`.
   * @returns {Promise<object>} Channel product listing for the tenant.
   */
  @Get('/api/v2/ce/channels/:channelId/products')
  async listChannelProducts(@Param() params, @Query() query) {
    const { channelId } = parseOrThrow(ceChannelIdParamsSchema, params, 'channel id');
    const parsedQuery = parseOrThrow(compatV2IntegrationProductsQuerySchema, query, 'query');
    return this.compatibilityHttpService.listIntegrationProductsForCompatV2(channelId, parsedQuery);
  }

  /**
   * GET `/api/v2/ce/channels` — lists commerce integrations visible to the tenant (CE channel envelope).
   * @returns {Promise<object>} Integration collection with external integer channel ids when configured.
   */
  @Get('/api/v2/ce/channels')
  async listCommerceIntegrations() {
    return this.compatibilityHttpService.listIntegrationsForCompatV2();
  }

  /**
   * POST `/api/v2/ce/products` — bulk upsert/push catalog rows through compat v2 catalog command.
   * @param {object[]} body Array of product records (loose record schema at controller edge).
   * @param {string | string[] | undefined} idempotencyKey CE compat idempotency context.
   * @returns {Promise<object>} Per-SKU success/failure batch envelope.
   */
  @Post('/api/v2/ce/products')
  @HttpCode(200)
  async pushProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'push products');
    return this.compatibilityHttpService.pushProductsForCompatV2(parsed, idempotencyKey);
  }

  /**
   * PUT `/api/v2/ce/offer/stock` — adjusts offer stock lines for tenant catalog (inventory writes).
   * @param {object[]} body Stock update batch.
   * @param {string | string[] | undefined} idempotencyKey Idempotency for inventory mutation replay.
   * @returns {Promise<object>} Batch stock update ApiResponse.
   */
  @Put('/api/v2/ce/offer/stock')
  @HttpCode(200)
  async updateOfferStock(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'update offer stock');
    return this.compatibilityHttpService.updateOfferStockForCompatV2(parsed, idempotencyKey);
  }

  /**
   * PUT `/api/v2/ce/offer` — updates channel offer prices (pricing create/update via routeDeps).
   * @param {object[]} body Price lines batch.
   * @param {string | string[] | undefined} idempotencyKey Idempotency header.
   * @returns {Promise<object>} Price mutation envelope.
   */
  @Put('/api/v2/ce/offer')
  @HttpCode(200)
  async updateOfferPrice(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'update offer price');
    return this.compatibilityHttpService.updateOfferPriceForCompatV2(parsed, idempotencyKey);
  }

  /**
   * POST `/api/v2/ce/products/freeze` — suspends offers or deactivates products for listed SKUs.
   * @param {object[]} body Product freeze batch.
   * @param {string | string[] | undefined} idempotencyKey Idempotency for catalog mutation.
   * @returns {Promise<object>} Per-SKU freeze results.
   */
  @Post('/api/v2/ce/products/freeze')
  @HttpCode(200)
  async freezeProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'freeze products');
    return this.compatibilityHttpService.freezeProductsForCompatV2(parsed, idempotencyKey);
  }

  /**
   * POST `/api/v2/ce/products/bulkdelete` — soft-deactivates products by merchant SKU list.
   * @param {Array<string|number>} body SKU identifiers to deactivate.
   * @param {string | string[] | undefined} idempotencyKey Idempotency key.
   * @returns {Promise<object>} Bulk delete batch envelope.
   */
  @Post('/api/v2/ce/products/bulkdelete')
  @HttpCode(200)
  async bulkDeleteProducts(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceBulkDeleteBodySchema, body, 'bulk delete products');
    return this.compatibilityHttpService.bulkDeleteProductsForCompatV2(parsed, idempotencyKey);
  }

  /**
   * PATCH `/api/v2/ce/products/extra-data/bulk` — merges extra-data attributes on products.
   * @param {object[]} body Extra-data patch batch.
   * @param {string | string[] | undefined} idempotencyKey Idempotency for content updates.
   * @returns {Promise<object>} Patch batch ApiResponse.
   */
  @Patch('/api/v2/ce/products/extra-data/bulk')
  @HttpCode(200)
  async patchExtraData(@Body() body, @Headers('idempotency-key') idempotencyKey) {
    const parsed = parseOrThrow(ceRecordArrayBodySchema, body, 'patch extra data');
    return this.compatibilityHttpService.patchExtraDataForCompatV2(parsed, idempotencyKey);
  }

  /**
   * PUT `/api/v2/ce/shipments/:merchantShipmentNo/delivery-state` — updates shipment delivery status/timestamp.
   * @param {object} params Merchant shipment number path param.
   * @param {object} body Delivery state (`Status`, optional `DeliveredAt`).
   * @param {string | string[] | undefined} idempotencyKey Idempotency for shipment mutation.
   * @returns {Promise<object>} Delivery update envelope.
   */
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
    return this.compatibilityHttpService.updateShipmentDeliveryStateForCompatV2(
      merchantShipmentNo,
      parsed,
      idempotencyKey,
    );
  }
}
export { CompatV2Controller };
