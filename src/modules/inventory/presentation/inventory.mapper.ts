import type { InventoryBalance } from '../domain/inventory-balance.js';
import type { StockLocation } from '../domain/stock-location.js';
import type { BalanceSnapshot } from '../public/inventory-service.js';

export function toStockLocationResponse(location: StockLocation) {
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

export function toBalanceResponse(balance: InventoryBalance) {
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

export function toBalanceSnapshotResponse(snapshot: BalanceSnapshot) {
  return {
    onHand: snapshot.onHand,
    reserved: snapshot.reserved,
    available: snapshot.available,
  };
}
