/** Maps an internal inventory shape into an API-safe StockLocationResponse object (dates serialized where needed). */
export function toStockLocationResponse(location) {
    return {
        id: location.id,
        tenantId: location.tenantId,
        name: location.name,
        externalReference: location.externalReference,
        status: location.status,
        createdAt: location.createdAt.toISOString(),
        updatedAt: location.updatedAt.toISOString(),
    };
}
/** Maps an internal inventory shape into an API-safe BalanceResponse object (dates serialized where needed). */
export function toBalanceResponse(balance) {
    return {
        id: balance.id,
        tenantId: balance.tenantId,
        stockLocationId: balance.stockLocationId,
        productId: balance.productId,
        onHand: balance.onHand,
        reserved: balance.reserved,
        available: balance.available,
        createdAt: balance.createdAt.toISOString(),
        updatedAt: balance.updatedAt.toISOString(),
    };
}
/** Maps an internal inventory shape into an API-safe BalanceSnapshotResponse object (dates serialized where needed). */
export function toBalanceSnapshotResponse(snapshot) {
    return {
        onHand: snapshot.onHand,
        reserved: snapshot.reserved,
        available: snapshot.available,
    };
}
