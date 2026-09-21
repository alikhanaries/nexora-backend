export function toCancellationDto(cancellation) {
    return {
        id: cancellation.id,
        tenantId: cancellation.tenantId,
        orderId: cancellation.orderId,
        status: cancellation.status,
        reason: cancellation.reason,
        createdAt: cancellation.createdAt,
        updatedAt: cancellation.updatedAt,
        completedAt: cancellation.completedAt,
    };
}
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
