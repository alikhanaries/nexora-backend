import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createListCancellations } from '../../../src/modules/cancellations/services/list-cancellations.js';

describe('createListCancellations', () => {
  it('returns a cursor page and maps cancellations to DTOs', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const list = createListCancellations({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      cancellations: {
        listPage: vi.fn(async () => ({
          items: [{ id: 'c1', tenantId: 't1', orderId: 'o1', status: 'COMPLETED', createdAt }],
        })),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['cancellations.read'],
      limit: 50,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('c1');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('sets hasMore and nextCursor when an extra row is fetched', async () => {
    const t = new Date('2024-01-15T10:00:00.000Z');
    const list = createListCancellations({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      cancellations: {
        listPage: vi.fn(async () => ({
          items: [
            { id: 'c1', tenantId: 't1', orderId: 'o1', status: 'COMPLETED', createdAt: t },
            { id: 'c2', tenantId: 't1', orderId: 'o1', status: 'COMPLETED', createdAt: t },
          ],
        })),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['cancellations.read'],
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('passes filters and tenantId to the repository', async () => {
    const listPage = vi.fn(async () => ({ items: [] }));
    const list = createListCancellations({
      authorization: { requirePermission: vi.fn() },
      queryable: { tag: 'q' },
      cancellations: { listPage },
    });

    await list.execute({
      tenantId: 'tenant-a',
      actorPermissions: ['cancellations.read'],
      orderId: 'order-1',
      status: 'COMPLETED',
      limit: 10,
    });

    expect(listPage).toHaveBeenCalledWith(
      { tag: 'q' },
      'tenant-a',
      expect.objectContaining({
        orderId: 'order-1',
        status: 'COMPLETED',
      }),
      11,
      null,
      null,
    );
  });

  it('requires cancellations.read permission', async () => {
    const list = createListCancellations({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      queryable: {},
      cancellations: { listPage: vi.fn() },
    });

    await expect(
      list.execute({ tenantId: 't1', actorPermissions: [], limit: 10 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
