import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
import type { EventRecorder } from '../../../shared/events/index.js';
import type { Transaction } from '../../../shared/persistence/index.js';
import { OrderLineStatus } from '../domain/order-line-status.js';
import type { OrderLine } from '../domain/order-line.js';
import { OrderStatus, isOrderCancellable } from '../domain/order-status.js';
import type { OrderRepository } from '../domain/order-repository.port.js';
import { toOrderDto } from './order-dto.js';
import { orderCancelledEvent, orderStatusChangedEvent } from './order-events.js';
import type {
  AppliedCancellationLine,
  ApplyCancellationInput,
  ApplyCancellationResult,
  OrderFulfillmentLineInput,
  OrderFulfillmentService,
} from '../public/order-fulfillment-service.js';

export interface DefaultOrderFulfillmentServiceDeps {
  readonly orders: OrderRepository;
  readonly eventRecorder: EventRecorder;
}

export class DefaultOrderFulfillmentService implements OrderFulfillmentService {
  constructor(private readonly deps: DefaultOrderFulfillmentServiceDeps) {}

  async applyCancellation(
    transaction: Transaction,
    input: ApplyCancellationInput,
  ): Promise<ApplyCancellationResult> {
    const order = await this.deps.orders.lockOrderForUpdate(
      transaction,
      input.tenantId,
      input.orderId,
    );
    if (order === null) {
      throw new NotFoundError('Order was not found', {
        tenantId: input.tenantId,
        orderId: input.orderId,
      });
    }

    if (!isOrderCancellable(order.status)) {
      throw new BusinessRuleError('Order cannot be cancelled in its current status', {
        orderId: input.orderId,
        status: order.status,
      });
    }

    const lockedLines = await this.deps.orders.lockOrderLinesForUpdate(
      transaction,
      input.tenantId,
      input.orderId,
    );
    if (lockedLines.length === 0) {
      throw new BusinessRuleError('Order has no lines to cancel');
    }

    const lineById = new Map(lockedLines.map((line) => [line.id, line]));
    const updates =
      input.lines.length === 0
        ? lockedLines
            .filter((line) => line.cancellableQuantity() > 0)
            .map((line) => ({ orderLineId: line.id, quantity: line.cancellableQuantity() }))
        : input.lines;

    if (updates.length === 0) {
      throw new BusinessRuleError('No cancellable quantity remains on this order');
    }

    const now = new Date();
    const appliedLines: AppliedCancellationLine[] = [];

    for (const update of updates) {
      if (!Number.isInteger(update.quantity) || update.quantity <= 0) {
        throw new ValidationError('Cancellation quantity must be a positive integer');
      }

      const line = lineById.get(update.orderLineId);
      if (line === undefined) {
        throw new NotFoundError('Order line was not found on this order', {
          orderId: input.orderId,
          orderLineId: update.orderLineId,
        });
      }

      const cancellable = line.cancellableQuantity();
      if (update.quantity > cancellable) {
        throw new BusinessRuleError('Cancellation quantity exceeds cancellable quantity', {
          orderLineId: line.id,
          cancellable,
          requested: update.quantity,
        });
      }

      const cancelledQuantity = line.cancelledQuantity + update.quantity;
      const status = cancelledQuantity === line.quantity ? OrderLineStatus.CANCELLED : line.status;

      const updatedLine = line.withUpdatedQuantities({
        cancelledQuantity,
        status,
        updatedAt: now,
      });

      await this.deps.orders.updateOrderLine(transaction, updatedLine);
      lineById.set(line.id, updatedLine);

      appliedLines.push({
        orderLineId: line.id,
        productId: line.productId,
        stockLocationId: line.stockLocationId,
        quantity: update.quantity,
      });
    }

    const allLines = lockedLines.map((line) => lineById.get(line.id) ?? line);
    const fullyCancelled = allLines.every((line) => line.cancelledQuantity === line.quantity);

    const previousOrderStatus = order.status;
    let updatedOrder = order;

    if (fullyCancelled) {
      updatedOrder = order.transitionTo(OrderStatus.CANCELLED, now);
      await this.deps.orders.updateOrder(transaction, updatedOrder);

      const orderDto = toOrderDto(updatedOrder);
      await this.deps.eventRecorder.record(
        transaction,
        orderStatusChangedEvent(orderDto, previousOrderStatus),
      );
      await this.deps.eventRecorder.record(transaction, orderCancelledEvent(orderDto));
    }

    return {
      order: toOrderDto(updatedOrder),
      appliedLines,
      previousOrderStatus,
    };
  }

  async lockOrderLinesForFulfillment(
    tenantId: string,
    orderId: string,
    tx: Transaction,
  ): Promise<readonly OrderLine[]> {
    const order = await this.deps.orders.lockOrderForUpdate(tx, tenantId, orderId);
    if (order === null) {
      throw new NotFoundError('Order was not found', { tenantId, orderId });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BusinessRuleError('Cannot fulfill a cancelled order', {
        orderId,
        status: order.status,
      });
    }
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.RETURNED) {
      throw new BusinessRuleError('Order is not open for shipment', {
        orderId,
        status: order.status,
      });
    }

    return this.deps.orders.lockOrderLinesForUpdate(tx, tenantId, orderId);
  }

  async applyShipmentQuantities(
    tenantId: string,
    orderId: string,
    lines: readonly OrderFulfillmentLineInput[],
    tx: Transaction,
  ): Promise<void> {
    if (lines.length === 0) {
      throw new ValidationError('At least one shipment line is required');
    }

    const locked = await this.lockOrderLinesForFulfillment(tenantId, orderId, tx);
    const byId = new Map(locked.map((line) => [line.id, line]));

    for (const input of lines) {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new ValidationError('Shipment line quantity must be a positive integer');
      }

      const line = byId.get(input.orderLineId);
      if (line === undefined) {
        throw new NotFoundError('Order line was not found on this order', {
          tenantId,
          orderId,
          orderLineId: input.orderLineId,
        });
      }

      const shippable = line.shippableQuantity();
      if (input.quantity > shippable) {
        throw new BusinessRuleError('Shipment quantity exceeds shippable quantity', {
          orderLineId: input.orderLineId,
          requestedQuantity: input.quantity,
          shippableQuantity: shippable,
        });
      }

      const shippedQuantity = line.shippedQuantity + input.quantity;
      const updated = line.withUpdatedQuantities({
        shippedQuantity,
        status:
          shippedQuantity >= line.quantity - line.cancelledQuantity
            ? OrderLineStatus.CLOSED
            : line.status,
      });

      await this.deps.orders.updateOrderLine(tx, updated);
      byId.set(input.orderLineId, updated);
    }
  }

  async reverseShipmentQuantities(
    tenantId: string,
    orderId: string,
    lines: readonly OrderFulfillmentLineInput[],
    tx: Transaction,
  ): Promise<void> {
    const locked = await this.lockOrderLinesForFulfillment(tenantId, orderId, tx);
    const byId = new Map(locked.map((line) => [line.id, line]));

    for (const input of lines) {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new ValidationError('Shipment line quantity must be a positive integer');
      }

      const line = byId.get(input.orderLineId);
      if (line === undefined) {
        throw new NotFoundError('Order line was not found on this order', {
          tenantId,
          orderId,
          orderLineId: input.orderLineId,
        });
      }

      if (input.quantity > line.shippedQuantity) {
        throw new BusinessRuleError('Cannot reverse more than shipped quantity', {
          orderLineId: input.orderLineId,
          requestedQuantity: input.quantity,
          shippedQuantity: line.shippedQuantity,
        });
      }

      const shippedQuantity = line.shippedQuantity - input.quantity;
      const updated = line.withUpdatedQuantities({
        shippedQuantity,
        status:
          shippedQuantity < line.quantity - line.cancelledQuantity
            ? OrderLineStatus.OPEN
            : line.status,
      });

      await this.deps.orders.updateOrderLine(tx, updated);
      byId.set(input.orderLineId, updated);
    }
  }

  async evaluateOrderShipmentState(
    tenantId: string,
    orderId: string,
    tx: Transaction,
  ): Promise<void> {
    const order = await this.deps.orders.findById(tx, tenantId, orderId);
    if (order === null) {
      throw new NotFoundError('Order was not found', { tenantId, orderId });
    }

    const lines = await this.deps.orders.listOrderLines(tx, tenantId, orderId);
    const allNonCancelledShipped = lines.every(
      (line) => line.shippedQuantity >= line.quantity - line.cancelledQuantity,
    );

    if (!allNonCancelledShipped) {
      return;
    }

    let updated = order;
    const previousStatus = order.status;

    if (updated.status === OrderStatus.CONFIRMED) {
      updated = updated.transitionTo(OrderStatus.PROCESSING);
    }
    if (updated.status === OrderStatus.PROCESSING) {
      updated = updated.transitionTo(OrderStatus.READY_TO_SHIP);
    }
    if (updated.status === OrderStatus.READY_TO_SHIP) {
      updated = updated.transitionTo(OrderStatus.SHIPPED);
    }

    if (updated.status === previousStatus) {
      return;
    }

    await this.deps.orders.updateOrder(tx, updated);
    await this.deps.eventRecorder.record(
      tx,
      orderStatusChangedEvent(toOrderDto(updated), previousStatus),
    );
  }
}
