/** Maps an internal shipment shape into an API-safe ShipmentDto object (dates serialized where needed). */
export function toShipmentDto(shipment) {
    return {
        id: shipment.id,
        tenantId: shipment.tenantId,
        orderId: shipment.orderId,
        externalReference: shipment.externalReference,
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
/** Maps an internal shipment shape into an API-safe ShipmentLineDto object (dates serialized where needed). */
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
/** Maps an internal shipment shape into an API-safe ShipmentDetailDto object (dates serialized where needed). */
export function toShipmentDetailDto(shipment, lines) {
    return {
        ...toShipmentDto(shipment),
        lines: lines.map(toShipmentLineDto),
    };
}
