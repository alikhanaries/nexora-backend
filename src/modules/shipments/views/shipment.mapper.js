/** Maps an internal shipment shape into an API-safe ShipmentResponse object (dates serialized where needed). */
export function toShipmentResponse(shipment) {
    return {
        id: shipment.id,
        tenantId: shipment.tenantId,
        orderId: shipment.orderId,
        externalReference: shipment.externalReference ?? null,
        carrier: shipment.carrier,
        service: shipment.service,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        shippedAt: shipment.shippedAt?.toISOString() ?? null,
        deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
        createdAt: shipment.createdAt.toISOString(),
        updatedAt: shipment.updatedAt.toISOString(),
    };
}
/** Maps an internal shipment shape into an API-safe ShipmentLineResponse object (dates serialized where needed). */
export function toShipmentLineResponse(line) {
    return {
        id: line.id,
        tenantId: line.tenantId,
        shipmentId: line.shipmentId,
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        createdAt: line.createdAt.toISOString(),
    };
}
/** Maps an internal shipment shape into an API-safe ShipmentDetailResponse object (dates serialized where needed). */
export function toShipmentDetailResponse(shipment) {
    return {
        ...toShipmentResponse(shipment),
        lines: shipment.lines.map(toShipmentLineResponse),
    };
}
