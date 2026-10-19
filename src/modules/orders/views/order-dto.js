export function toOrderDto(order) {
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
export function toOrderLineDto(line) {
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
export function toCustomerSnapshotDto(snapshot) {
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
