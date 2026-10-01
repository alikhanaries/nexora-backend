import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  adjustInventoryBodySchema,
  createStockLocationBodySchema,
  inventoryListQuerySchema,
  productIdParamsSchema,
  receiveInventoryBodySchema,
  releaseInventoryBodySchema,
  reserveInventoryBodySchema,
  stockLocationIdParamsSchema,
} from '../../modules/inventory/presentation/inventory.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { InventoryService } from './inventory.service.js';

export @Controller()
class InventoryController {
  constructor(@Inject(InventoryService) inventoryService) {
    this.inventoryService = inventoryService;
  }

  @Get('/api/v1/stock-locations')
  async listStockLocations() {
    const data = await this.inventoryService.listStockLocations();
    return { success: true, data };
  }

  @Post('/api/v1/stock-locations')
  @HttpCode(201)
  async createStockLocation(@Body() body) {
    const parsed = parseOrThrow(createStockLocationBodySchema, body, 'create stock location');
    const data = await this.inventoryService.createStockLocation(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/stock-locations/:stockLocationId')
  async getStockLocation(@Param() params) {
    const { stockLocationId } = parseOrThrow(stockLocationIdParamsSchema, params, 'stock location params');
    const data = await this.inventoryService.getStockLocation(stockLocationId);
    return { success: true, data };
  }

  @Get('/api/v1/inventory')
  async listInventory(@Query() query) {
    const parsed = inventoryListQuerySchema.parse(query);
    const data = await this.inventoryService.listInventory(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/inventory/:productId')
  async getProductInventory(@Param() params, @Query() query) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const parsed = inventoryListQuerySchema.parse(query);
    const data = await this.inventoryService.listInventory(parsed, productId);
    return { success: true, data };
  }

  @Post('/api/v1/inventory/adjustments')
  @HttpCode(200)
  async adjust(@Body() body) {
    const parsed = parseOrThrow(adjustInventoryBodySchema, body, 'adjust inventory');
    const data = await this.inventoryService.adjustInventory(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/inventory/receipts')
  @HttpCode(200)
  async receive(@Body() body) {
    const parsed = parseOrThrow(receiveInventoryBodySchema, body, 'receive inventory');
    const data = await this.inventoryService.receiveInventory(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/inventory/reservations')
  @HttpCode(200)
  async reserve(@Body() body) {
    const parsed = parseOrThrow(reserveInventoryBodySchema, body, 'reserve inventory');
    const data = await this.inventoryService.reserveInventory(parsed);
    return { success: true, data };
  }

  @Post('/api/v1/inventory/releases')
  @HttpCode(200)
  async release(@Body() body) {
    const parsed = parseOrThrow(releaseInventoryBodySchema, body, 'release inventory');
    const data = await this.inventoryService.releaseInventory(parsed);
    return { success: true, data };
  }
}
