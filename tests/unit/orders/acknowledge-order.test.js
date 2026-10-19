import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { createAcknowledgeOrder } from '../../../src/modules/orders/services/acknowledge-order.js';

describe('createAcknowledgeOrder', () => {
  it('delegates to confirmOrder with the resolved order id', async () => {
    const confirmOrder = {
      execute: vi.fn(async () => ({ order: { id: 'o1', orderNumber: 'ORD-1', status: 'CONFIRMED' } })),
    };
    const acknowledgeOrder = createAcknowledgeOrder({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      orders: {
        findByOrderNumber: vi.fn(async () => ({ id: 'o1', orderNumber: 'ORD-1' })),
      },
      confirmOrder,
    });

    const result = await acknowledgeOrder.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['orders.update'],
      orderNumber: 'ORD-1',
      transaction: { tx: true },
    });

    expect(confirmOrder.execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 't1',
      orderId: 'o1',
      transaction: { tx: true },
    }));
    expect(result.order.id).toBe('o1');
  });

  it('throws NotFoundError when order number is unknown', async () => {
    const acknowledgeOrder = createAcknowledgeOrder({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      orders: {
        findByOrderNumber: vi.fn(async () => null),
      },
      confirmOrder: { execute: vi.fn() },
    });

    await expect(
      acknowledgeOrder.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['orders.update'],
        orderNumber: 'missing',
        transaction: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
