import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createListOrders } from '../../../src/modules/orders/services/list-orders.js';

describe('createListOrders', () => {
  it('returns a cursor page and maps orders to DTOs', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const list = createListOrders({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      orders: {
        list: vi.fn(async () => [
          { id: 'o1', status: 'NEW', createdAt },
        ]),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['orders.read'],
      limit: 50,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('o1');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('sets hasMore and nextCursor when an extra row is fetched', async () => {
    const t = new Date('2024-01-15T10:00:00.000Z');
    const list = createListOrders({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      orders: {
        list: vi.fn(async () => [
          { id: 'o1', status: 'NEW', createdAt: t },
          { id: 'o2', status: 'NEW', createdAt: t },
        ]),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['orders.read'],
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('passes filters and tenantId to the repository', async () => {
    const listFn = vi.fn(async () => []);
    const list = createListOrders({
      authorization: { requirePermission: vi.fn() },
      queryable: { tag: 'q' },
      orders: { list: listFn },
    });

    await list.execute({
      tenantId: 'tenant-a',
      actorPermissions: ['orders.read'],
      channelId: 'ch-1',
      externalOrderReference: 'EXT-1',
      limit: 10,
    });

    expect(listFn).toHaveBeenCalledWith(
      { tag: 'q' },
      'tenant-a',
      expect.objectContaining({
        channelId: 'ch-1',
        externalOrderReference: 'EXT-1',
      }),
      11,
      undefined,
    );
  });

  it('requires orders.read permission', async () => {
    const list = createListOrders({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      queryable: {},
      orders: { list: vi.fn() },
    });

    await expect(
      list.execute({ tenantId: 't1', actorPermissions: [], limit: 10 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
