import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable, Transaction } from '../../../shared/persistence/index.js';
import type { OrderRepository } from '../domain/order-repository.port.js';
import { toOrderDto, toOrderLineDto, type OrderDto, type OrderLineDto } from './order-dto.js';

export interface OrderQueryService {
  getOrderById(tenantId: string, orderId: string, tx?: Transaction): Promise<OrderDto>;
  getOrderLines(
    tenantId: string,
    orderId: string,
    tx?: Transaction,
  ): Promise<readonly OrderLineDto[]>;
  verifyOrderBelongsToTenant(
    tenantId: string,
    orderId: string,
    tx?: Transaction,
  ): Promise<OrderDto>;
}

export interface DefaultOrderQueryServiceDeps {
  readonly queryable: Queryable;
  readonly orders: OrderRepository;
}

export class DefaultOrderQueryService implements OrderQueryService {
  constructor(private readonly deps: DefaultOrderQueryServiceDeps) {}

  async getOrderById(tenantId: string, orderId: string, tx?: Transaction): Promise<OrderDto> {
    const queryable = tx ?? this.deps.queryable;
    const order = await this.deps.orders.findById(queryable, tenantId, orderId);
    if (order === null) {
      throw new NotFoundError('Order was not found', { tenantId, orderId });
    }
    return toOrderDto(order);
  }

  async getOrderLines(
    tenantId: string,
    orderId: string,
    tx?: Transaction,
  ): Promise<readonly OrderLineDto[]> {
    const queryable = tx ?? this.deps.queryable;
    const lines = await this.deps.orders.listOrderLines(queryable, tenantId, orderId);
    return lines.map(toOrderLineDto);
  }

  async verifyOrderBelongsToTenant(
    tenantId: string,
    orderId: string,
    tx?: Transaction,
  ): Promise<OrderDto> {
    return this.getOrderById(tenantId, orderId, tx);
  }
}
