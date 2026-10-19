import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { createGetOrder } from '../../../src/modules/orders/services/get-order.js';

describe('createGetOrder', () => {
  it('returns order with lines and customer', async () => {
    const order = { id: 'o1', tenantId: 't1', status: 'NEW' };
    const getOrder = createGetOrder({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      orders: {
        findById: vi.fn(async () => order),
        listOrderLines: vi.fn(async () => [{ id: 'l1' }]),
        findCustomerSnapshot: vi.fn(async () => null),
      },
    });

    const result = await getOrder.execute({
      tenantId: 't1',
      orderId: 'o1',
      actorPermissions: [],
    });

    expect(result.order.id).toBe('o1');
    expect(result.order.lines).toHaveLength(1);
  });

  it('throws NotFoundError when order is missing', async () => {
    const getOrder = createGetOrder({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      orders: {
        findById: vi.fn(async () => null),
        listOrderLines: vi.fn(),
        findCustomerSnapshot: vi.fn(),
      },
    });

    await expect(
      getOrder.execute({ tenantId: 't1', orderId: 'missing', actorPermissions: ['orders:read'] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
