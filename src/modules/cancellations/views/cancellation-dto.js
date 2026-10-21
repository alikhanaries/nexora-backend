/** Maps an internal cancellation shape into an API-safe CancellationDto object (dates serialized where needed). */
export function toCancellationDto(cancellation) {
    return {
        id: cancellation.id,
        tenantId: cancellation.tenantId,
        orderId: cancellation.orderId,
        externalReference: cancellation.externalReference,
        status: cancellation.status,
        reason: cancellation.reason,
        createdAt: cancellation.createdAt,
        updatedAt: cancellation.updatedAt,
        completedAt: cancellation.completedAt,
    };
}
/** Maps an internal cancellation shape into an API-safe CancellationLineDto object (dates serialized where needed). */
export function toCancellationLineDto(line) {
    return {
        id: line.id,
        tenantId: line.tenantId,
        cancellationId: line.cancellationId,
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        createdAt: line.createdAt,
    };
}
