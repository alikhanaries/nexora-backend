import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import type { OrderFulfillmentService } from '../../orders/public/order-fulfillment-service.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { ShipmentRepository } from '../domain/shipment-repository.port.js';
import { toShipmentDetailDto, type ShipmentDetailDto } from './shipment-dto.js';
import { shipmentCancelledEvent, shipmentStatusChangedEvent } from './shipment-events.js';
import { requireShipmentsUpdate } from './shipment-permissions.js';

export interface CancelShipmentInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly shipmentId: string;
}

export interface CancelShipmentResult {
  readonly shipment: ShipmentDetailDto;
}

export interface CancelShipmentDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly shipments: ShipmentRepository;
  readonly orderFulfillmentService: OrderFulfillmentService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class CancelShipment {
  constructor(private readonly deps: CancelShipmentDependencies) {}

  async execute(input: CancelShipmentInput): Promise<CancelShipmentResult> {
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

        const lines = await this.deps.shipments.listShipmentLines(tx, input.tenantId, existing.id);
        const previousStatus = existing.status;
        const updated = existing.cancel();
        await this.deps.shipments.updateShipment(tx, updated);

        await this.deps.orderFulfillmentService.reverseShipmentQuantities(
          input.tenantId,
          existing.orderId,
          lines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
          })),
          tx,
        );

        await this.deps.orderFulfillmentService.evaluateOrderShipmentState(
          input.tenantId,
          existing.orderId,
          tx,
        );

        const detail = toShipmentDetailDto(updated, lines);

        if (previousStatus !== updated.status) {
          await this.deps.eventRecorder.record(
            tx,
            shipmentStatusChangedEvent(detail, previousStatus),
          );
          await this.deps.eventRecorder.record(tx, shipmentCancelledEvent(detail));
        }

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'SHIPMENT_CANCELLED',
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
