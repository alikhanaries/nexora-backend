/**
 * Nest facade for the StockConnect ERP integration API (`/api/v2/stock-connect/*`).
 * Maps DTOs and delegates catalog/commerce commands built from `CORE_SERVICES` — no HTTP concerns.
 */
import { Inject, Injectable } from '@nestjs/common';
import { toProductResponse } from '../../../../products/views/product.mapper.js';
import { toStockConnectChannel } from '../../mappers/stock-connect-channel.mapper.js';
import {
  toStockConnectOrderDetail,
  toStockConnectOrderSummary,
} from '../../mappers/stock-connect-order.mapper.js';
import { toStockConnectProduct } from '../../mappers/stock-connect-product.mapper.js';
import { requireActorContext } from '../../../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey } from '../../../../../shared/idempotency/index.js';
import { commerceActorFields } from '../../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../../app/di/core-services.tokens.js';
import { createStockConnectCatalogCommands } from '../../services/stock-connect-catalog-commands.js';
import { createStockConnectCommerceCommands } from '../../services/stock-connect-commerce-commands.js';

const ROUTE_PREFIX = '/api/v2/stock-connect';

/**
 * Standard Stock Connect list response wrapper with mapped items and cursor fields.
 * @param {{ items: unknown[], nextCursor: string | null, hasMore: boolean }} page
 * @param {(item: unknown) => unknown} mapItem
 */
function paginationEnvelope(page, mapItem) {
  return {
    success: true,
    integration: 'stock-connect',
    data: {
      items: page.items.map(mapItem),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    },
  };
}

/** Shared service injected by split StockConnect controllers (products, orders, inventory, etc.). */
@Injectable()
class StockConnectIntegrationService {
  /** Wires catalog and commerce command facades from injected core services. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
    const catalog = createStockConnectCatalogCommands(coreServices);
    this.productsService = catalog;
    this.inventoryService = catalog;
    this.offersService = catalog;
    const commerce = createStockConnectCommerceCommands(coreServices);
    this.ordersService = commerce;
    this.shipmentsService = commerce;
    this.channelsService = commerce;
    this.cancellationsService = commerce;
  }

  /** Integration metadata and API version for health checks. */
  ping() {
    return {
      success: true,
      integration: 'stock-connect',
      data: { message: 'ok', apiVersion: 'v2' },
    };
  }

  /**
   * Lists Stock Connect products or looks up one by `merchantSku` with inventory summary.
   * @param {Record<string, unknown>} query
   */
  async listProducts(query) {
    if (query.merchantSku !== undefined) {
      const actor = requireActorContext();
      const product = await this.coreServices.products.productQueryService.getProductBySku(
        actor.tenantId,
        query.merchantSku.trim(),
      );
      if (product === null) {
        return {
          success: true,
          integration: 'stock-connect',
          data: { items: [], nextCursor: null, hasMore: false },
        };
      }
      const mapped = toProductResponse(product);
      const summary = await this.readInventorySummary(mapped.id);
      return {
        success: true,
        integration: 'stock-connect',
        data: {
          items: [toStockConnectProduct(mapped, summary)],
          nextCursor: null,
          hasMore: false,
        },
      };
    }
    const page = await this.productsService.listProducts({
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return paginationEnvelope(page, (item) => toStockConnectProduct(item));
  }

  /** Single product with optional aggregated available quantity. */
  async getProduct(productId) {
    const product = await this.productsService.getProduct(productId);
    const summary = await this.readInventorySummary(productId);
    return {
      success: true,
      integration: 'stock-connect',
      data: toStockConnectProduct(product, summary),
    };
  }

  /** Creates a product and returns the Stock Connect product shape. */
  async createProduct(body) {
    const product = await this.productsService.createProduct(body);
    return {
      success: true,
      integration: 'stock-connect',
      data: toStockConnectProduct(product),
    };
  }

  /** Updates a product and returns the Stock Connect product shape. */
  async updateProduct(productId, body) {
    const product = await this.productsService.updateProduct(productId, body);
    return {
      success: true,
      integration: 'stock-connect',
      data: toStockConnectProduct(product),
    };
  }

  /**
   * Idempotent publish: create offer when missing, then activate on the requested channel.
   * @param {string} productId
   * @param {Record<string, unknown>} body
   * @param {string | string[] | undefined} idempotencyKeyHeader
   */
  async publishProduct(productId, body, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const requestFingerprint = fingerprintRequest({ productId, ...body });
    const outcome = await this.coreServices.orders.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: `${ROUTE_PREFIX}/products/:productId/publish`,
        idempotencyKey,
      },
      requestFingerprint,
      async () => {
        let offerId = body.offerId;
        if (offerId === undefined) {
          const created = await this.offersService.createOffer({
            productId,
            channelId: body.channelId,
          });
          offerId = created.id;
        }
        const offer = await this.offersService.activateOffer(offerId, {
          ...(body.resolvePricing === undefined ? {} : { resolvePricing: body.resolvePricing }),
          ...(body.currency === undefined ? {} : { currency: body.currency }),
        });
        return {
          success: true,
          integration: 'stock-connect',
          data: {
            productId,
            channelId: body.channelId,
            offer,
          },
        };
      },
      (responseBody) => ({ statusCode: 200, body: responseBody }),
    );
    return outcome.value;
  }

  /** Paginated orders in Stock Connect summary shape. */
  async listOrders(query) {
    const page = await this.ordersService.listOrders(this.toOrderListQuery(query));
    return paginationEnvelope(page, (item) => toStockConnectOrderSummary(item));
  }

  /** Same listing as `listOrders` with sync window echoed in the payload. */
  async syncOrders(query) {
    const page = await this.ordersService.listOrders(this.toOrderListQuery(query));
    return {
      success: true,
      integration: 'stock-connect',
      data: {
        items: page.items.map((item) => toStockConnectOrderSummary(item)),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        sync: {
          updatedAfter: query.updatedAfter ?? null,
          updatedBefore: query.updatedBefore ?? null,
        },
      },
    };
  }

  /** Maps HTTP query DTO fields to the commerce command list-orders input. */
  toOrderListQuery(query) {
    return {
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
      ...(query.externalOrderReference === undefined
        ? {}
        : { externalOrderReference: query.externalOrderReference }),
      ...(query.orderNumber === undefined ? {} : { orderNumber: query.orderNumber }),
      ...(query.createdAfter === undefined ? {} : { createdAfter: query.createdAfter }),
      ...(query.createdBefore === undefined ? {} : { createdBefore: query.createdBefore }),
      ...(query.updatedAfter === undefined ? {} : { updatedAfter: query.updatedAfter }),
      ...(query.updatedBefore === undefined ? {} : { updatedBefore: query.updatedBefore }),
    };
  }

  /** Order detail in Stock Connect shape. */
  async getOrder(orderId) {
    const order = await this.ordersService.getOrder(orderId);
    return {
      success: true,
      integration: 'stock-connect',
      data: toStockConnectOrderDetail(order),
    };
  }

  /** Idempotent order cancellation; returns refreshed order detail. */
  async cancelOrder(orderId, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const requestFingerprint = fingerprintRequest({ orderId });
    const outcome = await this.coreServices.orders.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: `${ROUTE_PREFIX}/orders/:orderId/cancel`,
        idempotencyKey,
      },
      requestFingerprint,
      async () => {
        await this.cancellationsService.cancelOrder(orderId, {});
        const order = await this.ordersService.getOrder(orderId);
        return {
          success: true,
          integration: 'stock-connect',
          data: toStockConnectOrderDetail(order),
        };
      },
      (responseBody) => ({ statusCode: 200, body: responseBody }),
    );
    return outcome.value;
  }

  /** Inventory balances for one product. */
  async getProductInventory(productId, query) {
    const balances = await this.inventoryService.listInventory(query, productId);
    return {
      success: true,
      integration: 'stock-connect',
      data: {
        productId,
        // listInventory already returns mapped balance responses.
        balances,
      },
    };
  }

  /** Idempotent stock adjustment at a location. */
  async adjustInventory(body, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    const requestFingerprint = fingerprintRequest(body);
    const outcome = await this.coreServices.orders.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: `${ROUTE_PREFIX}/inventory/adjustments`,
        idempotencyKey,
      },
      requestFingerprint,
      async () => {
        const data = await this.inventoryService.adjustInventory({
          productId: body.productId,
          stockLocationId: body.stockLocationId,
          delta: body.quantityDelta,
          ...(body.reason === undefined ? {} : { reason: body.reason }),
        });
        return {
          success: true,
          integration: 'stock-connect',
          data,
        };
      },
      (responseBody) => ({ statusCode: 200, body: responseBody }),
    );
    return outcome.value;
  }

  /** Delegates shipment creation to commerce commands and wraps the Stock Connect envelope. */
  async createShipment(orderId, body, idempotencyKeyHeader) {
    const result = await this.shipmentsService.createShipment(orderId, body, idempotencyKeyHeader);
    return {
      success: true,
      integration: 'stock-connect',
      data: result.data ?? result,
    };
  }

  /** Transitions a shipment to shipped with optional carrier metadata. */
  async shipShipment(shipmentId, body) {
    const data = await this.shipmentsService.shipShipment(shipmentId, body);
    return {
      success: true,
      integration: 'stock-connect',
      data,
    };
  }

  /** Shipment detail in Stock Connect envelope. */
  async getShipment(shipmentId) {
    const data = await this.shipmentsService.getShipment(shipmentId);
    return {
      success: true,
      integration: 'stock-connect',
      data,
    };
  }

  /** Commerce integrations mapped to Stock Connect channel items. */
  async listCommerceIntegrations() {
    const channels = await this.channelsService.listCommerceIntegrations({});
    return {
      success: true,
      integration: 'stock-connect',
      data: {
        items: channels.map((item) => toStockConnectChannel(item)),
      },
    };
  }

  /** Best-effort sum of available quantity across locations; zero when inventory is unreadable. */
  async readInventorySummary(productId) {
    try {
      const balances = await this.inventoryService.listInventory({}, productId);
      const totalAvailable = balances.reduce((sum, row) => sum + (row.available ?? 0), 0);
      return { totalAvailable };
    } catch {
      return { totalAvailable: 0 };
    }
  }
}
export { StockConnectIntegrationService };
