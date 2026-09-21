import type { AuthorizationService } from '../../authorization/public/index.js';
import {
  clampCursorLimit,
  decodeCursor,
  encodeCursor,
  type CursorPage,
} from '../../../shared/pagination/index.js';
import type { Queryable } from '../../../shared/persistence/index.js';
import type { Order } from '../domain/order.js';
import type { OrderListFilters, OrderRepository } from '../domain/order-repository.port.js';
import { toOrderDto, type OrderDto } from './order-dto.js';
import { requireOrdersRead } from './order-permissions.js';

export interface ListOrdersInput extends OrderListFilters {
  readonly tenantId: string;
  readonly actorPermissions: readonly string[];
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

export interface ListOrdersDependencies {
  readonly authorization: AuthorizationService;
  readonly queryable: Queryable;
  readonly orders: OrderRepository;
}

function encodeOrderListCursor(order: Order): string {
  return encodeCursor([order.createdAt.toISOString(), order.id]);
}

export class ListOrders {
  constructor(private readonly deps: ListOrdersDependencies) {}

  async execute(input: ListOrdersInput): Promise<CursorPage<OrderDto>> {
    requireOrdersRead(this.deps.authorization, input.actorPermissions);

    const limit = clampCursorLimit(input.limit);
    const cursor = input.cursor === undefined ? undefined : decodeCursor(input.cursor);
    const fetchLimit = limit + 1;

    const rows = await this.deps.orders.list(
      this.deps.queryable,
      input.tenantId,
      {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.channelId === undefined ? {} : { channelId: input.channelId }),
        ...(input.externalOrderReference === undefined
          ? {}
          : { externalOrderReference: input.externalOrderReference }),
        ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
        ...(input.createdAfter === undefined ? {} : { createdAfter: input.createdAfter }),
        ...(input.createdBefore === undefined ? {} : { createdBefore: input.createdBefore }),
      },
      fetchLimit,
      cursor,
    );

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const last = pageItems.at(-1);

    return {
      items: pageItems.map((order) => toOrderDto(order)),
      nextCursor: hasMore && last !== undefined ? encodeOrderListCursor(last) : null,
      hasMore,
    };
  }
}
