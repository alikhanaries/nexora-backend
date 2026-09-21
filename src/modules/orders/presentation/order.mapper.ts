import type {
  CustomerSnapshotDto,
  OrderDetailDto,
  OrderDto,
  OrderLineDto,
} from '../application/order-dto.js';

export function toOrderResponse(order: OrderDto) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    channelId: order.channelId,
    externalOrderReference: order.externalOrderReference,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

export function toOrderLineResponse(line: OrderLineDto) {
  return {
    id: line.id,
    productId: line.productId,
    offerId: line.offerId,
    stockLocationId: line.stockLocationId,
    merchantSku: line.merchantSku,
    productTypeSnapshot: line.productTypeSnapshot,
    quantity: line.quantity,
    cancelledQuantity: line.cancelledQuantity,
    shippedQuantity: line.shippedQuantity,
    returnedQuantity: line.returnedQuantity,
    unitPriceMinor: line.unitPriceMinor,
    discountMinor: line.discountMinor,
    taxMinor: line.taxMinor,
    lineTotalMinor: line.lineTotalMinor,
    currency: line.currency,
    status: line.status,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

export function toCustomerSnapshotResponse(snapshot: CustomerSnapshotDto) {
  return {
    id: snapshot.id,
    externalCustomerReference: snapshot.externalCustomerReference,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    email: snapshot.email,
    phone: snapshot.phone,
    companyName: snapshot.companyName,
    billingAddress: snapshot.billingAddress === null ? null : { ...snapshot.billingAddress },
    shippingAddress: snapshot.shippingAddress === null ? null : { ...snapshot.shippingAddress },
    metadata: { ...snapshot.metadata },
    createdAt: snapshot.createdAt.toISOString(),
  };
}

export function toOrderDetailResponse(order: OrderDetailDto) {
  return {
    ...toOrderResponse(order),
    lines: order.lines.map(toOrderLineResponse),
    customer: order.customer === null ? null : toCustomerSnapshotResponse(order.customer),
  };
}
