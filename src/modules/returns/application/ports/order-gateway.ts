import type { Queryable, Transaction } from '../../../../shared/persistence/index.js';

export interface OrderLineSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly stockLocationId: string;
  readonly shippedQuantity: number;
  readonly returnedQuantity: number;
}

export interface OrderSnapshot {
  readonly id: string;
  readonly tenantId: string;
  readonly status: string;
}

export interface ReturnOrderGateway {
  findOrder(queryable: Queryable, tenantId: string, orderId: string): Promise<OrderSnapshot | null>;

  lockOrderLinesForUpdate(
    transaction: Transaction,
    tenantId: string,
    orderId: string,
  ): Promise<readonly OrderLineSnapshot[]>;

  updateOrderLineReturnedQuantity(
    transaction: Transaction,
    tenantId: string,
    orderLineId: string,
    returnedQuantity: number,
    updatedAt: Date,
  ): Promise<void>;
}
