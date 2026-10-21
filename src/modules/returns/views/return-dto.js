/** Maps an internal return shape into an API-safe ReturnDto object (dates serialized where needed). */
export function toReturnDto(returnEntity) {
    return {
        id: returnEntity.id,
        tenantId: returnEntity.tenantId,
        orderId: returnEntity.orderId,
        externalReference: returnEntity.externalReference,
        shipmentId: returnEntity.shipmentId,
        status: returnEntity.status,
        reason: returnEntity.reason,
        createdAt: returnEntity.createdAt,
        updatedAt: returnEntity.updatedAt,
        receivedAt: returnEntity.receivedAt,
        completedAt: returnEntity.completedAt,
    };
}
/** Maps an internal return shape into an API-safe ReturnLineDto object (dates serialized where needed). */
export function toReturnLineDto(line) {
    return {
        id: line.id,
        tenantId: line.tenantId,
        returnId: line.returnId,
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        reason: line.reason,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
    };
}
/** Maps an internal return shape into an API-safe ReturnDetailDto object (dates serialized where needed). */
export function toReturnDetailDto(returnEntity, lines) {
    return {
        ...toReturnDto(returnEntity),
        lines: lines.map(toReturnLineDto),
    };
}
