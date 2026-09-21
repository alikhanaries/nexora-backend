import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ShipmentRepository } from '../domain/shipment-repository.port.js';
import { toShipmentDetailDto, type ShipmentDetailDto } from './shipment-dto.js';
import { shipmentShippedEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

export interface ShipShipmentInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly shipmentId: string;
  readonly carrier?: string | null;
  readonly service?: string | null;
  readonly trackingNumber?: string | null;
}

export interface ShipShipmentResult {
  readonly shipment: ShipmentDetailDto;
}

export interface ShipShipmentDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly shipments: ShipmentRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class ShipShipment {
  constructor(private readonly deps: ShipShipmentDependencies) {}

  async execute(input: ShipShipmentInput): Promise<ShipShipmentResult> {
    requireShipmentsUpdate(this.deps.authorization, input.actorPermissions);

    const shipment = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.shipments.lockShipmentForUpdate(
          tx,
          input.tenantId,
          input.shipmentId,
        );
        if (existing === null) {
          throw new NotFoundError('Shipment was not found', {
            tenantId: input.tenantId,
            shipmentId: input.shipmentId,
          });
        }

        const previousStatus = existing.status;
        const now = new Date();
        let updated = existing.ship();

        if (
          input.carrier !== undefined ||
          input.service !== undefined ||
          input.trackingNumber !== undefined
        ) {
          updated = updated.withCarrierDetails(
            {
              ...(input.carrier === undefined
                ? {}
                : { carrier: normalizeOptionalText(input.carrier) }),
              ...(input.service === undefined
                ? {}
                : { service: normalizeOptionalText(input.service) }),
              ...(input.trackingNumber === undefined
                ? {}
                : { trackingNumber: normalizeOptionalText(input.trackingNumber) }),
            },
            now,
          );
        }

        await this.deps.shipments.updateShipment(tx, updated);

        const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
        const detail = toShipmentDetailDto(updated, lines);

        if (previousStatus !== updated.status) {
          await this.deps.eventRecorder.record(
            tx,
            shipmentStatusChangedEvent(detail, previousStatus),
          );
          await this.deps.eventRecorder.record(tx, shipmentShippedEvent(detail));
        }

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'SHIPMENT_SHIPPED',
          resourceType: 'shipment',
          resourceId: updated.id,
          metadata: {
            orderId: updated.orderId,
            previousStatus,
            newStatus: updated.status,
            trackingNumber: updated.trackingNumber,
          },
          ...auditRequestFields(),
        });

        return detail;
      },
      { tenantId: input.tenantId },
    );

    return { shipment };
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
