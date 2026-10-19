function toCancellationLineResponse(line) {
    return {
        id: line.id,
        tenantId: line.tenantId,
        cancellationId: line.cancellationId,
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        createdAt: line.createdAt.toISOString(),
    };
}
export function toCancellationResponse(cancellation) {
    return {
        id: cancellation.id,
        tenantId: cancellation.tenantId,
        orderId: cancellation.orderId,
        status: cancellation.status,
        reason: cancellation.reason,
        createdAt: cancellation.createdAt.toISOString(),
        updatedAt: cancellation.updatedAt.toISOString(),
        completedAt: cancellation.completedAt?.toISOString() ?? null,
    };
}
export function toCancellationDetailResponse(cancellation) {
    return {
        ...toCancellationResponse(cancellation),
        lines: cancellation.lines.map(toCancellationLineResponse),
    };
}
