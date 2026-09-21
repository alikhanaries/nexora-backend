import type { AddressSnapshot, CustomerSnapshot } from '../domain/customer-snapshot.js';
import type { OrderLine } from '../domain/order-line.js';
import type { Order } from '../domain/order.js';

export interface OrderLineDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly offerId: string | null;
  readonly stockLocationId: string;
  readonly merchantSku: string;
  readonly productTypeSnapshot: string;
  readonly quantity: number;
  readonly cancelledQuantity: number;
  readonly shippedQuantity: number;
  readonly returnedQuantity: number;
  readonly unitPriceMinor: number;
  readonly discountMinor: number;
  readonly taxMinor: number;
  readonly lineTotalMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CustomerSnapshotDto {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly externalCustomerReference: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly companyName: string | null;
  readonly billingAddress: AddressSnapshot | null;
  readonly shippingAddress: AddressSnapshot | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface OrderDto {
  readonly id: string;
  readonly tenantId: string;
  readonly channelId: string;
  readonly externalOrderReference: string | null;
  readonly orderNumber: string;
  readonly status: string;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly taxMinor: number;
  readonly shippingMinor: number;
  readonly totalMinor: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly confirmedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
}

export interface OrderDetailDto extends OrderDto {
  readonly lines: readonly OrderLineDto[];
  readonly customer: CustomerSnapshotDto | null;
}

export function toOrderDto(order: Order): OrderDto {
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
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
  };
}

export function toOrderLineDto(line: OrderLine): OrderLineDto {
  return {
    id: line.id,
    tenantId: line.tenantId,
    orderId: line.orderId,
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
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  };
}

export function toCustomerSnapshotDto(snapshot: CustomerSnapshot): CustomerSnapshotDto {
  return {
    id: snapshot.id,
    tenantId: snapshot.tenantId,
    orderId: snapshot.orderId,
    externalCustomerReference: snapshot.externalCustomerReference,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    email: snapshot.email,
    phone: snapshot.phone,
    companyName: snapshot.companyName,
    billingAddress: snapshot.billingAddress,
    shippingAddress: snapshot.shippingAddress,
    metadata: snapshot.metadata,
    createdAt: snapshot.createdAt,
  };
}
