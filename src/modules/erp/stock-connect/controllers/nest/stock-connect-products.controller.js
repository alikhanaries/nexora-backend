/**
 * Nest adapter for StockConnect product catalog APIs.
 * Routes under `/api/v2/stock-connect/products*`; delegates to StockConnectIntegrationService.
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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  stockConnectListProductsQuerySchema,
  stockConnectProductIdParamsSchema,
  stockConnectPublishProductBodySchema,
  stockConnectUpdateProductBodySchema,
  stockConnectUpsertProductBodySchema,
} from '../../views/stock-connect.schemas.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { StockConnectIntegrationGuard } from './stock-connect-integration.guard.js';
import { StockConnectIntegrationService } from './stock-connect-integration.service.js';

@Controller()
@UseGuards(StockConnectIntegrationGuard)
class StockConnectProductsController {
  /** @param {StockConnectIntegrationService} stockConnectIntegrationService */
  constructor(@Inject(StockConnectIntegrationService) stockConnectIntegrationService) {
    this.stockConnectIntegrationService = stockConnectIntegrationService;
  }

  /** Lists products (paginated) or resolves a single SKU when `merchantSku` is provided. */
  @Get('/api/v2/stock-connect/products')
  async list(@Query() query) {
    const parsed = parseOrThrow(stockConnectListProductsQuerySchema, query, 'query');
    return this.stockConnectIntegrationService.listProducts(parsed);
  }

  /** Creates a catalog product. */
  @Post('/api/v2/stock-connect/products')
  @HttpCode(200)
  async create(@Body() body) {
    const parsed = parseOrThrow(stockConnectUpsertProductBodySchema, body, 'create product');
    return this.stockConnectIntegrationService.createProduct(parsed);
  }

  /** Product detail including aggregated available inventory when readable. */
  @Get('/api/v2/stock-connect/products/:productId')
  async getById(@Param() params) {
    const { productId } = parseOrThrow(stockConnectProductIdParamsSchema, params, 'product params');
    return this.stockConnectIntegrationService.getProduct(productId);
  }

  /** Partial product update. */
  @Patch('/api/v2/stock-connect/products/:productId')
  @HttpCode(200)
  async update(@Param() params, @Body() body) {
    const { productId } = parseOrThrow(stockConnectProductIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(stockConnectUpdateProductBodySchema, body, 'update product');
    return this.stockConnectIntegrationService.updateProduct(productId, parsed);
  }

  /** Creates or activates an offer on a channel; requires `idempotency-key`. */
  @Post('/api/v2/stock-connect/products/:productId/publish')
  @HttpCode(200)
  async publish(
    @Param() params,
    @Body() body,
    @Headers('idempotency-key') idempotencyKey,
  ) {
    const { productId } = parseOrThrow(stockConnectProductIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(stockConnectPublishProductBodySchema, body, 'publish product');
    return this.stockConnectIntegrationService.publishProduct(productId, parsed, idempotencyKey);
  }
}
export { StockConnectProductsController };
