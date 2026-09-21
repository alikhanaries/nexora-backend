export function toShipmentDto(shipment) {
    return {
        id: shipment.id,
        tenantId: shipment.tenantId,
        orderId: shipment.orderId,
        carrier: shipment.carrier,
        service: shipment.service,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        shippedAt: shipment.shippedAt,
        deliveredAt: shipment.deliveredAt,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
    };
}
export function toShipmentLineDto(line) {
    return {
        id: line.id,
        tenantId: line.tenantId,
        shipmentId: line.shipmentId,
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        createdAt: line.createdAt,
    };
}
export function toShipmentDetailDto(shipment, lines) {
    return {
        ...toShipmentDto(shipment),
        lines: lines.map(toShipmentLineDto),
    };
}
