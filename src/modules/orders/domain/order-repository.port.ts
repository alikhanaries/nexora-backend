import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { CustomerSnapshot } from './customer-snapshot.js';
import type { OrderLine } from './order-line.js';
import type { Order } from './order.js';
import type { OrderStatus } from './order-status.js';

export interface OrderListFilters {
  readonly status?: OrderStatus;
  readonly channelId?: string;
  readonly externalOrderReference?: string;
  readonly orderNumber?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

export interface OrderRepository {
  findById(queryable: Queryable, tenantId: string, orderId: string): Promise<Order | null>;
  lockOrderForUpdate(
    transaction: Transaction,
    tenantId: string,
    orderId: string,
  ): Promise<Order | null>;
  findByOrderNumber(
    queryable: Queryable,
    tenantId: string,
    orderNumber: string,
  ): Promise<Order | null>;
  list(
    queryable: Queryable,
    tenantId: string,
    filters: OrderListFilters,
    limit: number,
    cursor?: readonly string[],
  ): Promise<readonly Order[]>;
  insertOrder(transaction: Transaction, order: Order): Promise<void>;
  updateOrder(transaction: Transaction, order: Order): Promise<void>;
  insertOrderLine(transaction: Transaction, line: OrderLine): Promise<void>;
  updateOrderLine(transaction: Transaction, line: OrderLine): Promise<void>;
  listOrderLines(
    queryable: Queryable,
    tenantId: string,
    orderId: string,
  ): Promise<readonly OrderLine[]>;
  lockOrderLinesForUpdate(
    transaction: Transaction,
    tenantId: string,
    orderId: string,
  ): Promise<readonly OrderLine[]>;
  lockOrderLineForUpdate(
    transaction: Transaction,
    tenantId: string,
    orderLineId: string,
  ): Promise<OrderLine | null>;
  insertCustomerSnapshot(transaction: Transaction, snapshot: CustomerSnapshot): Promise<void>;
  findCustomerSnapshot(
    queryable: Queryable,
    tenantId: string,
    orderId: string,
  ): Promise<CustomerSnapshot | null>;
  allocateOrderNumber(transaction: Transaction, tenantId: string): Promise<string>;
}
