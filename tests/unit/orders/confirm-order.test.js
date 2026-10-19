import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { Order } from '../../../src/modules/orders/models/order.js';
import { OrderStatus } from '../../../src/modules/orders/models/order-status.js';
import { createConfirmOrder } from '../../../src/modules/orders/services/confirm-order.js';

function makeOrder(overrides = {}) {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return Order.reconstitute({
    id: 'o1',
    tenantId: 't1',
    channelId: 'ch-1',
    externalOrderReference: null,
    orderNumber: 'ORD-1',
    status: OrderStatus.CONFIRMED,
    currency: 'USD',
    subtotalMinor: 100,
    discountMinor: 0,
    taxMinor: 0,
    shippingMinor: 0,
    totalMinor: 100,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    cancelledAt: null,
    shippedAt: null,
    deliveredAt: null,
    ...overrides,
  });
}

describe('createConfirmOrder', () => {
  it('returns already-confirmed order when status is CONFIRMED', async () => {
    const existing = makeOrder();
    const confirmOrder = createConfirmOrder({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      orders: {
        lockOrderForUpdate: vi.fn(async () => existing),
        listOrderLines: vi.fn(async () => []),
        findCustomerSnapshot: vi.fn(async () => null),
        updateOrder: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
    });

    const result = await confirmOrder.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['orders.update'],
      orderId: 'o1',
      transaction: {},
    });

    expect(result.order.id).toBe('o1');
    expect(result.order.status).toBe(OrderStatus.CONFIRMED);
    expect(result.order.lines).toEqual([]);
  });

  it('throws NotFoundError when order is missing', async () => {
    const confirmOrder = createConfirmOrder({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      orders: {
        lockOrderForUpdate: vi.fn(async () => null),
        listOrderLines: vi.fn(),
        findCustomerSnapshot: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
    });

    await expect(
      confirmOrder.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['orders.update'],
        orderId: 'missing',
        transaction: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
