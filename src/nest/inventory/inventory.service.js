import { Inject, Injectable } from '@nestjs/common';
import { optionalReferenceFields } from '../../modules/inventory/application/optional-fields.js';
import {
  toBalanceResponse,
  toBalanceSnapshotResponse,
  toStockLocationResponse,
} from '../../modules/inventory/presentation/inventory.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { withCommerceMetric } from '../../shared/metrics/record-commerce-operation.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class InventoryService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.inventory.useCases;
  }

  get metrics() {
    return this.coreDomain.metrics;
  }

  async listStockLocations() {
    const actor = requireActorContext();
    const { locations } = await this.useCases.listStockLocations.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return locations.map(toStockLocationResponse);
  }

  async createStockLocation(body) {
    const actor = requireActorContext();
    const { location } = await this.useCases.createStockLocation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(actor.userId === undefined ? {} : { actorId: actor.userId }),
      name: body.name,
      ...(body.externalReference === undefined ? {} : { externalReference: body.externalReference }),
    });
    return toStockLocationResponse(location);
  }

  async getStockLocation(stockLocationId) {
    const actor = requireActorContext();
    const { location } = await this.useCases.getStockLocation.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      stockLocationId,
    });
    return toStockLocationResponse(location);
  }

  async listInventory(query, productId) {
    const actor = requireActorContext();
    const { balances } = await this.useCases.getInventory.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(productId === undefined ? {} : { productId }),
      ...(query.stockLocationId === undefined ? {} : { stockLocationId: query.stockLocationId }),
    });
    return balances.map(toBalanceResponse);
  }

  async adjustInventory(body) {
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.adjust', () =>
      this.useCases.adjustInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: body.stockLocationId,
        productId: body.productId,
        delta: body.delta,
        ...optionalReferenceFields(body),
      }),
    );
    return {
      idempotent: result.idempotent,
      balance: toBalanceSnapshotResponse(result.balance),
    };
  }

  async receiveInventory(body) {
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.receive', () =>
      this.useCases.receiveInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: body.stockLocationId,
        productId: body.productId,
        quantity: body.quantity,
        ...optionalReferenceFields(body),
      }),
    );
    return {
      idempotent: result.idempotent,
      balance: toBalanceSnapshotResponse(result.balance),
    };
  }

  async reserveInventory(body) {
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.reserve', () =>
      this.useCases.reserveInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: body.stockLocationId,
        productId: body.productId,
        quantity: body.quantity,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        ...optionalReferenceFields({ idempotencyKey: body.idempotencyKey }),
      }),
    );
    return {
      reservationId: result.reservationId,
      idempotent: result.idempotent,
      balance: toBalanceSnapshotResponse(result.balance),
    };
  }

  async releaseInventory(body) {
    const actor = requireActorContext();
    const result = await withCommerceMetric(this.metrics, 'inventory.release', () =>
      this.useCases.releaseInventory.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        stockLocationId: body.stockLocationId,
        productId: body.productId,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        ...(body.quantity === undefined ? {} : { quantity: body.quantity }),
        ...optionalReferenceFields({ idempotencyKey: body.idempotencyKey }),
      }),
    );
    return {
      reservationId: result.reservationId,
      idempotent: result.idempotent,
      balance: toBalanceSnapshotResponse(result.balance),
    };
  }
}
