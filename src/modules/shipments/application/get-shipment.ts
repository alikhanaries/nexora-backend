import type { AuthorizationService } from '../../authorization/public/index.js';
import { requireShipmentsRead } from './shipment-permissions.js';
import type { ShipmentDetailDto } from './shipment-dto.js';
import type { ShipmentQueryService } from '../public/shipment-query-service.js';

export interface GetShipmentInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly shipmentId: string;
}

export interface GetShipmentResult {
  readonly shipment: ShipmentDetailDto;
}

export interface GetShipmentDependencies {
  readonly authorization: AuthorizationService;
  readonly shipmentQueryService: ShipmentQueryService;
}

export class GetShipment {
  constructor(private readonly deps: GetShipmentDependencies) {}

  async execute(input: GetShipmentInput): Promise<GetShipmentResult> {
    requireShipmentsRead(this.deps.authorization, input.actorPermissions);

    const shipment = await this.deps.shipmentQueryService.getShipmentById(
      input.tenantId,
      input.shipmentId,
    );

    return { shipment };
  }
}
