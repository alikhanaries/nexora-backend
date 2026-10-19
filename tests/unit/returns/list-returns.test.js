import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createListReturns } from '../../../src/modules/returns/services/list-returns.js';

describe('createListReturns', () => {
  it('returns a cursor page and maps returns to DTOs', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const list = createListReturns({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      returns: {
        listPage: vi.fn(async () => ({
          items: [{
            id: 'r1',
            tenantId: 't1',
            orderId: 'o1',
            externalReference: null,
            shipmentId: null,
            status: 'REQUESTED',
            reason: null,
            receivedAt: null,
            completedAt: null,
            createdAt,
            updatedAt: createdAt,
          }],
        })),
        listReturnLines: vi.fn(async () => []),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['returns.read'],
      limit: 50,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('r1');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('sets hasMore and nextCursor when an extra row is fetched', async () => {
    const t = new Date('2024-01-15T10:00:00.000Z');
    const base = {
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      shipmentId: null,
      status: 'REQUESTED',
      reason: null,
      receivedAt: null,
      completedAt: null,
      createdAt: t,
      updatedAt: t,
    };
    const list = createListReturns({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      returns: {
        listPage: vi.fn(async () => ({
          items: [
            { ...base, id: 'r1' },
            { ...base, id: 'r2' },
          ],
        })),
        listReturnLines: vi.fn(async () => []),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['returns.read'],
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('passes filters and tenantId to the repository', async () => {
    const listPage = vi.fn(async () => ({ items: [] }));
    const list = createListReturns({
      authorization: { requirePermission: vi.fn() },
      queryable: { tag: 'q' },
      returns: { listPage, listReturnLines: vi.fn() },
    });

    await list.execute({
      tenantId: 'tenant-a',
      actorPermissions: ['returns.read'],
      orderId: 'order-1',
      status: 'REQUESTED',
      limit: 10,
    });

    expect(listPage).toHaveBeenCalledWith(
      { tag: 'q' },
      'tenant-a',
      expect.objectContaining({
        orderId: 'order-1',
        status: 'REQUESTED',
      }),
      11,
      null,
      null,
    );
  });

  it('requires returns.read permission', async () => {
    const list = createListReturns({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      queryable: {},
      returns: { listPage: vi.fn() },
    });

    await expect(
      list.execute({ tenantId: 't1', actorPermissions: [], limit: 10 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
