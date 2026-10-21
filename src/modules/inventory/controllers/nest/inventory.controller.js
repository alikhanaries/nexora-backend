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
} from '../../views/inventory.schemas.js';
import {
  toBalanceResponse,
  toBalanceSnapshotResponse,
  toStockLocationResponse,
} from '../../views/inventory.mapper.js';
import { optionalReferenceFields } from '../../services/optional-fields.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { withCommerceMetric } from '../../../../shared/metrics/record-commerce-operation.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { INVENTORY_ROUTES } from '../../routes/inventory.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Routes under `/api/v1/stock-locations` and `/api/v1/inventory*` (INVENTORY_ROUTES); handlers call `CORE_SERVICES.inventory.useCases`.
 */
@Controller()
class InventoryController {
/** Binds `CORE_SERVICES` inventory use cases for this HTTP adapter. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.inventory.useCases;
    this.metrics = coreServices.metrics;
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `listStockLocations`. */
  @Get(INVENTORY_ROUTES.listStockLocations.path)
  async listStockLocations() {
    const actor = requireActorContext();
    const { locations } = await this.useCases.listStockLocations.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: locations.map(toStockLocationResponse) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `createStockLocation`. */
  @Post(INVENTORY_ROUTES.createStockLocation.path)
  @HttpCode(201)
  async createStockLocation(@Body() body) {
    const parsed = parseOrThrow(createStockLocationBodySchema, body, 'create stock location');
    const actor = requireActorContext();
    const { location } = await this.useCases.createStockLocation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(actor.userId === undefined ? {} : { actorId: actor.userId }),
      name: parsed.name,
      ...(parsed.externalReference === undefined ? {} : { externalReference: parsed.externalReference }),
    });
    return { success: true, data: toStockLocationResponse(location) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `getStockLocation`. */
  @Get(INVENTORY_ROUTES.getStockLocation.path)
  async getStockLocation(@Param() params) {
    const { stockLocationId } = parseOrThrow(stockLocationIdParamsSchema, params, 'stock location params');
    const actor = requireActorContext();
    const { location } = await this.useCases.getStockLocation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      stockLocationId,
    });
    return { success: true, data: toStockLocationResponse(location) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `listInventory`. */
  @Get(INVENTORY_ROUTES.listInventory.path)
  async listInventory(@Query() query) {
    const parsed = parseOrThrow(inventoryListQuerySchema, query, 'query');
    const actor = requireActorContext();
    const { balances } = await this.useCases.getInventory.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.stockLocationId === undefined ? {} : { stockLocationId: parsed.stockLocationId }),
    });
    return { success: true, data: balances.map(toBalanceResponse) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `getProductInventory`. */
  @Get(INVENTORY_ROUTES.getProductInventory.path)
  async getProductInventory(@Param() params, @Query() query) {
    const { productId } = parseOrThrow(productIdParamsSchema, params, 'product params');
    const parsed = parseOrThrow(inventoryListQuerySchema, query, 'query');
    const actor = requireActorContext();
    const { balances } = await this.useCases.getInventory.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
      ...(parsed.stockLocationId === undefined ? {} : { stockLocationId: parsed.stockLocationId }),
    });
    return { success: true, data: balances.map(toBalanceResponse) };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `adjust`. */
  @Post(INVENTORY_ROUTES.adjust.path)
  @HttpCode(200)
  async adjust(@Body() body) {
    const parsed = parseOrThrow(adjustInventoryBodySchema, body, 'adjust inventory');
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.adjust', () =>
      this.useCases.adjustInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: parsed.stockLocationId,
        productId: parsed.productId,
        delta: parsed.delta,
        ...optionalReferenceFields(parsed),
      }),
    );
    return {
      success: true,
      data: {
        idempotent: result.idempotent,
        balance: toBalanceSnapshotResponse(result.balance),
      },
    };
  }

/** HTTP handler: validates input, reads tenant actor, delegates to inventory use case `receive`. */
  @Post(INVENTORY_ROUTES.receive.path)
  @HttpCode(200)
  async receive(@Body() body) {
    const parsed = parseOrThrow(receiveInventoryBodySchema, body, 'receive inventory');
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.receive', () =>
      this.useCases.receiveInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: parsed.stockLocationId,
        productId: parsed.productId,
        quantity: parsed.quantity,
        ...optionalReferenceFields(parsed),
      }),
    );
    return {
      success: true,
      data: {
        idempotent: result.idempotent,
        balance: toBalanceSnapshotResponse(result.balance),
      },
    };
  }

/**
   * POST reserve — increases reserved quantity when salable stock exists at the location.
   * Records movement/reservation rows; tenant and product must belong together.
   */
  @Post(INVENTORY_ROUTES.reserve.path)
  @HttpCode(200)
  async reserve(@Body() body) {
    const parsed = parseOrThrow(reserveInventoryBodySchema, body, 'reserve inventory');
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.reserve', () =>
      this.useCases.reserveInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: parsed.stockLocationId,
        productId: parsed.productId,
        quantity: parsed.quantity,
        referenceType: parsed.referenceType,
        referenceId: parsed.referenceId,
        ...optionalReferenceFields({ idempotencyKey: parsed.idempotencyKey }),
      }),
    );
    return {
      success: true,
      data: {
        reservationId: result.reservationId,
        idempotent: result.idempotent,
        balance: toBalanceSnapshotResponse(result.balance),
      },
    };
  }

/**
   * POST release — reverses a prior reservation (by reference or explicit keys) within the tenant.
   */
  @Post(INVENTORY_ROUTES.release.path)
  @HttpCode(200)
  async release(@Body() body) {
    const parsed = parseOrThrow(releaseInventoryBodySchema, body, 'release inventory');
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.release', () =>
      this.useCases.releaseInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: parsed.stockLocationId,
        productId: parsed.productId,
        referenceType: parsed.referenceType,
        referenceId: parsed.referenceId,
        ...(parsed.quantity === undefined ? {} : { quantity: parsed.quantity }),
        ...optionalReferenceFields({ idempotencyKey: parsed.idempotencyKey }),
      }),
    );
    return {
      success: true,
      data: {
        reservationId: result.reservationId,
        idempotent: result.idempotent,
        balance: toBalanceSnapshotResponse(result.balance),
      },
    };
  }
}
export { InventoryController };
