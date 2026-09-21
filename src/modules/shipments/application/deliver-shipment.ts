import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ShipmentRepository } from '../domain/shipment-repository.port.js';
import { toShipmentDetailDto, type ShipmentDetailDto } from './shipment-dto.js';
import { shipmentDeliveredEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

export interface DeliverShipmentInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly shipmentId: string;
}

export interface DeliverShipmentResult {
  readonly shipment: ShipmentDetailDto;
}

export interface DeliverShipmentDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly shipments: ShipmentRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class DeliverShipment {
  constructor(private readonly deps: DeliverShipmentDependencies) {}

  async execute(input: DeliverShipmentInput): Promise<DeliverShipmentResult> {
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
        const updated = existing.deliver();
        await this.deps.shipments.updateShipment(tx, updated);

        const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, updated.id);
        const detail = toShipmentDetailDto(updated, lines);

        if (previousStatus !== updated.status) {
          await this.deps.eventRecorder.record(
            tx,
            shipmentStatusChangedEvent(detail, previousStatus),
          );
          await this.deps.eventRecorder.record(tx, shipmentDeliveredEvent(detail));
        }

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'SHIPMENT_DELIVERED',
          resourceType: 'shipment',
          resourceId: updated.id,
          metadata: {
            orderId: updated.orderId,
            previousStatus,
            newStatus: updated.status,
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
