/** Maps an internal cancellation shape into an API-safe CancellationLineResponse object (dates serialized where needed). */
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
/** Maps an internal cancellation shape into an API-safe CancellationResponse object (dates serialized where needed). */
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
/** Maps an internal cancellation shape into an API-safe CancellationDetailResponse object (dates serialized where needed). */
export function toCancellationDetailResponse(cancellation) {
    return {
        ...toCancellationResponse(cancellation),
        lines: cancellation.lines.map(toCancellationLineResponse),
    };
}
