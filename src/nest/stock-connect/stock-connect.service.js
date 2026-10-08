import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { toChannelResponse } from '../../modules/channels/presentation/channel.mapper.js';
import { optionalReferenceFields } from '../../modules/inventory/application/optional-fields.js';
import {
  toBalanceResponse,
  toBalanceSnapshotResponse,
} from '../../modules/inventory/presentation/inventory.mapper.js';
import { OfferStatus } from '../../modules/offers/domain/offer-status.js';
import { toOfferResponse } from '../../modules/offers/presentation/offer.mapper.js';
import {
  toOrderDetailResponse,
  toOrderLineResponse,
  toOrderResponse,
} from '../../modules/orders/presentation/order.mapper.js';
import { toProductResponse } from '../../modules/products/presentation/product.mapper.js';
import { toShipmentDetailResponse } from '../../modules/shipments/presentation/shipment.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { ConflictError } from '../../shared/errors/index.js';
import { actorFingerprint } from '../../shared/http/actor-fingerprint.js';
import { fingerprintRequest } from '../../shared/idempotency/index.js';
import { withCommerceMetric } from '../../shared/metrics/record-commerce-operation.js';
import { commerceActorFields, productActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

function mapStockConnectOrder(order, lines) {
  return {
    id: order.id,
    orderId: order.id,
    tenantId: order.tenantId,
    channelId: order.channelId,
    externalOrderId: order.externalOrderReference,
    externalOrderReference: order.externalOrderReference,
    channelOrderNumber: order.externalOrderReference,
    merchantOrderNo: order.orderNumber,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    ...(order.customer === undefined ? {} : { customer: order.customer }),
    lines: lines.map((line) => ({
      id: line.id,
      merchantSku: line.merchantSku,
      quantity: line.quantity,
      productId: line.productId,
      orderLineId: line.id,
      cancelledQuantity: line.cancelledQuantity,
      shippedQuantity: line.shippedQuantity,
      unitPriceMinor: line.unitPriceMinor,
      status: line.status,
    })),
  };
}

export @Injectable()
class StockConnectService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  async listChannels() {
    const actor = requireActorContext();
    const { channels } = await this.coreDomain.channelRouteDeps.listChannels.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    const items = channels.map(toChannelResponse);
    return { items, nextCursor: null, hasMore: false, totalCount: items.length };
  }

  async listProducts(query) {
    const actor = requireActorContext();
    if (query.merchantSku !== undefined) {
      this.coreDomain.authorization.authorizationService.requirePermission(
        actor.permissions,
        'products.read',
      );
      const product = await this.coreDomain.products.productQueryService.getProductBySku(
        actor.tenantId,
        query.merchantSku,
      );
      const items = product === null ? [] : [toProductResponse(product)];
      return { items, nextCursor: null, hasMore: false, totalCount: items.length };
    }

    const page = await this.coreDomain.products.useCases.listProducts.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    });
    return {
      items: page.items.map(toProductResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async createProduct(body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.coreDomain.products.useCases.createProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      merchantSku: body.merchantSku,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.productType === undefined ? {} : { productType: body.productType }),
    });
    return toProductResponse(product);
  }

  async getProduct(productId) {
    const actor = requireActorContext();
    const { product } = await this.coreDomain.products.useCases.getProduct.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    return toProductResponse(product);
  }

  async patchProduct(productId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = productActorFields(actor);
    const { product } = await this.coreDomain.products.useCases.updateProduct.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      productId,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
      ...(body.productType === undefined ? {} : { productType: body.productType }),
    });
    return toProductResponse(product);
  }

  async publishProduct(productId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const channelId = body.channelId;

    await this.coreDomain.products.useCases.getProduct.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });

    const existingPage = await this.coreDomain.offers.useCases.listOffers.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
      channelId,
      limit: 1,
    });

    let offer = existingPage.items[0] ?? null;
    if (offer === null) {
      try {
        const created = await this.coreDomain.offers.useCases.createOffer.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          productId,
          channelId,
        });
        offer = created.offer;
      } catch (error) {
        if (!(error instanceof ConflictError)) {
          throw error;
        }
        const retry = await this.coreDomain.offers.useCases.listOffers.execute({
          tenantId: actor.tenantId,
          actorPermissions: actor.permissions,
          productId,
          channelId,
          limit: 1,
        });
        offer = retry.items[0] ?? null;
        if (offer === null) {
          throw error;
        }
      }
    }

    if (offer.status !== OfferStatus.ACTIVE) {
      const activated = await this.coreDomain.offers.useCases.activateOffer.execute({
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        offerId: offer.id,
      });
      offer = activated.offer;
    }

    return {
      productId,
      channelId,
      offer: toOfferResponse(offer),
    };
  }

  async getInventory(productId) {
    const actor = requireActorContext();
    const { product } = await this.coreDomain.products.useCases.getProduct.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    const { balances } = await this.coreDomain.inventory.useCases.getInventory.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      productId,
    });
    const mapped = balances.map(toBalanceResponse);
    const available = mapped.reduce((sum, row) => sum + row.available, 0);
    const reserved = mapped.reduce((sum, row) => sum + row.reserved, 0);
    const onHand = mapped.reduce((sum, row) => sum + row.onHand, 0);
    return {
      productId: product.id,
      merchantSku: product.merchantSku,
      available,
      reserved,
      onHand,
      balances: mapped,
    };
  }

  async adjustInventory(body) {
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.coreDomain.metrics, 'inventory.adjust', () =>
      this.coreDomain.inventory.useCases.adjustInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: body.stockLocationId,
        productId: body.productId,
        delta: body.quantityDelta,
        ...optionalReferenceFields({
          ...(body.idempotencyKey === undefined ? {} : { idempotencyKey: body.idempotencyKey }),
        }),
      }),
    );
    return {
      productId: body.productId,
      stockLocationId: body.stockLocationId,
      quantityDelta: body.quantityDelta,
      idempotent: result.idempotent,
      balance: toBalanceSnapshotResponse(result.balance),
    };
  }

  async listOrders(query) {
    const actor = requireActorContext();
    const page = await this.coreDomain.orders.useCases.listOrders.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.channelId === undefined ? {} : { channelId: query.channelId }),
    });
    const items = [];
    for (const order of page.items) {
      const lines = await this.coreDomain.orders.orderQueryService.getOrderLines(
        actor.tenantId,
        order.id,
      );
      items.push(mapStockConnectOrder(toOrderResponse(order), lines.map(toOrderLineResponse)));
    }
    return {
      items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async syncOrders(query) {
    const actor = requireActorContext();
    const page = await this.coreDomain.orders.orderQueryService.listOrders({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      page: 1,
      pageSize: query.limit ?? 50,
      ...(query.updatedAfter === undefined ? {} : { updatedAfter: new Date(query.updatedAfter) }),
      ...(query.updatedBefore === undefined
        ? {}
        : { updatedBefore: new Date(query.updatedBefore) }),
    });

    const items = page.items.map((order) =>
      mapStockConnectOrder(
        toOrderResponse({
          ...order,
          createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
          updatedAt: order.updatedAt instanceof Date ? order.updatedAt : new Date(order.updatedAt),
          confirmedAt:
            order.confirmedAt === null || order.confirmedAt === undefined
              ? null
              : order.confirmedAt instanceof Date
                ? order.confirmedAt
                : new Date(order.confirmedAt),
          cancelledAt:
            order.cancelledAt === null || order.cancelledAt === undefined
              ? null
              : order.cancelledAt instanceof Date
                ? order.cancelledAt
                : new Date(order.cancelledAt),
          shippedAt:
            order.shippedAt === null || order.shippedAt === undefined
              ? null
              : order.shippedAt instanceof Date
                ? order.shippedAt
                : new Date(order.shippedAt),
          deliveredAt:
            order.deliveredAt === null || order.deliveredAt === undefined
              ? null
              : order.deliveredAt instanceof Date
                ? order.deliveredAt
                : new Date(order.deliveredAt),
        }),
        (order.lines ?? []).map((line) =>
          toOrderLineResponse({
            ...line,
            createdAt: line.createdAt instanceof Date ? line.createdAt : new Date(line.createdAt),
            updatedAt: line.updatedAt instanceof Date ? line.updatedAt : new Date(line.updatedAt),
          }),
        ),
      ),
    );

    return {
      items,
      nextCursor: null,
      hasMore: page.page * page.pageSize < page.totalCount,
      totalCount: page.totalCount,
    };
  }

  async getOrder(orderId) {
    const actor = requireActorContext();
    const { order } = await this.coreDomain.orders.useCases.getOrder.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      orderId,
    });
    const detail = toOrderDetailResponse(order);
    return mapStockConnectOrder(detail, detail.lines);
  }

  async cancelOrder(orderId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { cancellation } = await this.coreDomain.cancellations.useCases.createCancellation.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      orderId,
      permission: 'orders.cancel',
      ...(body.reason === undefined ? {} : { reason: body.reason }),
      ...(body.lines === undefined ? {} : { lines: body.lines }),
    });
    return {
      orderId,
      cancellationId: cancellation.id,
      status: cancellation.status,
    };
  }

  async createShipment(orderId, body, idempotencyKeyHeader) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const fingerprint = fingerprintRequest({ orderId, ...body });
    const idempotencyKey =
      typeof idempotencyKeyHeader === 'string' && idempotencyKeyHeader.length > 0
        ? idempotencyKeyHeader
        : `sc-ship-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;

    const outcome = await this.coreDomain.shipments.useCases.idempotency.execute(
      {
        tenantId: actor.tenantId,
        principalFingerprint: actorFingerprint(actor),
        routeId: 'POST /api/v2/stock-connect/orders/:orderId/shipments',
        idempotencyKey,
      },
      fingerprint,
      async (tx) => {
        const { shipment } = await this.coreDomain.shipments.useCases.createShipment.execute({
          tenantId: actor.tenantId,
          actorId,
          actorKind,
          actorPermissions: actor.permissions,
          orderId,
          lines: body.lines,
          ...(body.carrier === undefined ? {} : { carrier: body.carrier }),
          ...(body.service === undefined ? {} : { service: body.service }),
          ...(body.trackingNumber === undefined ? {} : { trackingNumber: body.trackingNumber }),
          transaction: tx,
        });
        return toShipmentDetailResponse(shipment);
      },
      (responseBody) => ({ statusCode: 201, body: responseBody }),
      { useTransaction: true },
    );
    return outcome.value;
  }

  async getShipment(shipmentId) {
    const actor = requireActorContext();
    const { shipment } = await this.coreDomain.shipments.useCases.getShipment.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      shipmentId,
    });
    return toShipmentDetailResponse(shipment);
  }

  async shipShipment(shipmentId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = commerceActorFields(actor);
    const { shipment } = await this.coreDomain.shipments.useCases.shipShipment.execute({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      shipmentId,
      ...(body.carrier === undefined ? {} : { carrier: body.carrier }),
      ...(body.service === undefined ? {} : { service: body.service }),
      ...(body.trackingNumber === undefined ? {} : { trackingNumber: body.trackingNumber }),
    });
    return toShipmentDetailResponse(shipment);
  }
}
