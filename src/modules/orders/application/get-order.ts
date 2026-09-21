import type { AuthorizationService } from '../../authorization/public/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { OrderRepository } from '../domain/order-repository.port.js';
import {
  toCustomerSnapshotDto,
  toOrderDto,
  toOrderLineDto,
  type OrderDetailDto,
} from './order-dto.js';
import { requireOrdersRead } from './order-permissions.js';

export interface GetOrderInput {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly orderId: string;
}

export interface GetOrderResult {
  readonly order: OrderDetailDto;
}

export interface GetOrderDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly orders: OrderRepository;
}

export class GetOrder {
  constructor(private readonly deps: GetOrderDependencies) {}

  async execute(input: GetOrderInput): Promise<GetOrderResult> {
    requireOrdersRead(this.deps.authorization, input.actorPermissions);

    const order = await this.deps.orders.findById(
      this.deps.queryable,
      input.tenantId,
      input.orderId,
    );
    if (order === null) {
      throw new NotFoundError('Order was not found', {
        tenantId: input.tenantId,
        orderId: input.orderId,
      });
    }

    const lines = await this.deps.orders.listOrderLines(
      this.deps.queryable,
      input.tenantId,
      input.orderId,
    );
    const customer = await this.deps.orders.findCustomerSnapshot(
      this.deps.queryable,
      input.tenantId,
      input.orderId,
    );

    return {
      order: {
        ...toOrderDto(order),
        lines: lines.map(toOrderLineDto),
        customer: customer === null ? null : toCustomerSnapshotDto(customer),
      },
    };
  }
}
