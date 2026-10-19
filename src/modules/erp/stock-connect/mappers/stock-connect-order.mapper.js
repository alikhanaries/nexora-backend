/**
 * Normalized order status for StockConnect (matches Wasl order status vocabulary).
 * @param {ReturnType<typeof import('../../../orders/views/order.mapper.js').toOrderResponse>} order
 */
export function toStockConnectOrderSummary(order) {
  return {
    id: order.id,
    channelId: order.channelId,
    externalOrderReference: order.externalOrderReference,
    orderNumber: order.orderNumber,
    status: order.status,
    integrationStatus: order.status,
    currency: order.currency,
    totalMinor: order.totalMinor,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * @param {ReturnType<typeof import('../../../orders/views/order.mapper.js').toOrderDetailResponse>} order
 */
export function toStockConnectOrderDetail(order) {
  return {
    ...toStockConnectOrderSummary(order),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    shippingMinor: order.shippingMinor,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    lines: order.lines,
    customer: order.customer,
  };
}
