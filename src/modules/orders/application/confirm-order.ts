import type { AuditRecorder } from '../../audit/public/index.js';
import { auditRequestFields } from '../../audit/public/index.js';
import type { AuthorizationService } from '../../authorization/public/index.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import { OrderStatus } from '../domain/order-status.js';
import type { OrderRepository } from '../domain/order-repository.port.js';
import {
  toCustomerSnapshotDto,
  toOrderDto,
  toOrderLineDto,
  type OrderDetailDto,
} from './order-dto.js';
import { orderConfirmedEvent, orderStatusChangedEvent } from './order-events.js';
import { requireOrdersUpdate } from './order-permissions.js';

export interface ConfirmOrderInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorKind: 'user' | 'api-key';
  readonly actorPermissions: readonly string[];
  readonly orderId: string;
}

export interface ConfirmOrderResult {
  readonly order: OrderDetailDto;
}

export interface ConfirmOrderDependencies {
  readonly authorization: AuthorizationService;
  readonly database: TransactionManager;
  readonly orders: OrderRepository;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export class ConfirmOrder {
  constructor(private readonly deps: ConfirmOrderDependencies) {}

  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderResult> {
    requireOrdersUpdate(this.deps.authorization, input.actorPermissions);

    const detail = await this.deps.database.execute(
      async (tx) => {
        const existing = await this.deps.orders.lockOrderForUpdate(
          tx,
          input.tenantId,
          input.orderId,
        );
        if (existing === null) {
          throw new NotFoundError('Order was not found', {
            tenantId: input.tenantId,
            orderId: input.orderId,
          });
        }

        if (existing.status === OrderStatus.CONFIRMED) {
          const lines = await this.deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
          const customer = await this.deps.orders.findCustomerSnapshot(
            tx,
            input.tenantId,
            input.orderId,
          );
          return {
            ...toOrderDto(existing),
            lines: lines.map(toOrderLineDto),
            customer: customer === null ? null : toCustomerSnapshotDto(customer),
          };
        }

        let updated;
        try {
          updated = existing.transitionTo(OrderStatus.CONFIRMED);
        } catch {
          throw new BusinessRuleError('Order cannot be confirmed in its current status', {
            orderId: input.orderId,
            status: existing.status,
          });
        }

        await this.deps.orders.updateOrder(tx, updated);
        const orderDto = toOrderDto(updated);
        await this.deps.eventRecorder.record(
          tx,
          orderStatusChangedEvent(orderDto, existing.status),
        );
        await this.deps.eventRecorder.record(tx, orderConfirmedEvent(orderDto));

        await this.deps.auditRecorder?.record(tx, {
          tenantId: input.tenantId,
          actorKind: input.actorKind,
          actorId: input.actorId,
          eventType: 'ORDER_STATUS_CHANGED',
          resourceType: 'order',
          resourceId: updated.id,
          metadata: {
            fromStatus: existing.status,
            toStatus: updated.status,
            orderNumber: updated.orderNumber,
          },
          ...auditRequestFields(),
        });

        const lines = await this.deps.orders.listOrderLines(tx, input.tenantId, input.orderId);
        const customer = await this.deps.orders.findCustomerSnapshot(
          tx,
          input.tenantId,
          input.orderId,
        );

        return {
          ...orderDto,
          lines: lines.map(toOrderLineDto),
          customer: customer === null ? null : toCustomerSnapshotDto(customer),
        };
      },
      { tenantId: input.tenantId },
    );

    return { order: detail };
  }
}
