import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { ShipmentRepository } from '../domain/shipment-repository.port.js';
import {
  toShipmentDetailDto,
  toShipmentDto,
  type ShipmentDetailDto,
  type ShipmentDto,
} from '../application/shipment-dto.js';

export interface ShipmentQueryService {
  getShipmentById(
    tenantId: string,
    shipmentId: string,
    tx?: Transaction,
  ): Promise<ShipmentDetailDto>;
  getShipmentSummaryById(
    tenantId: string,
    shipmentId: string,
    tx?: Transaction,
  ): Promise<ShipmentDto>;
}

export interface DefaultShipmentQueryServiceDeps {
  readonly queryable: Queryable;
  readonly shipments: ShipmentRepository;
}

export class DefaultShipmentQueryService implements ShipmentQueryService {
  constructor(private readonly deps: DefaultShipmentQueryServiceDeps) {}

  async getShipmentById(
    tenantId: string,
    shipmentId: string,
    tx?: Transaction,
  ): Promise<ShipmentDetailDto> {
    const queryable = tx ?? this.deps.queryable;
    const shipment = await this.deps.shipments.findById(queryable, tenantId, shipmentId);
    if (shipment === null) {
      throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
    }

    const lines = await this.deps.shipments.listShipmentLines(queryable, tenantId, shipmentId);
    return toShipmentDetailDto(shipment, lines);
  }

  async getShipmentSummaryById(
    tenantId: string,
    shipmentId: string,
    tx?: Transaction,
  ): Promise<ShipmentDto> {
    const queryable = tx ?? this.deps.queryable;
    const shipment = await this.deps.shipments.findById(queryable, tenantId, shipmentId);
    if (shipment === null) {
      throw new NotFoundError('Shipment was not found', { tenantId, shipmentId });
    }
    return toShipmentDto(shipment);
  }
}
