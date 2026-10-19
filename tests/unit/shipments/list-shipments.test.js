import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createListShipments } from '../../../src/modules/shipments/services/list-shipments.js';

describe('createListShipments', () => {
  it('returns a cursor page and maps shipments to DTOs', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const list = createListShipments({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      shipments: {
        listPage: vi.fn(async () => ({
          items: [{
            id: 's1',
            tenantId: 't1',
            orderId: 'o1',
            externalReference: null,
            carrier: null,
            service: null,
            trackingNumber: null,
            status: 'CREATED',
            shippedAt: null,
            deliveredAt: null,
            createdAt,
            updatedAt: createdAt,
          }],
        })),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['shipments.read'],
      limit: 50,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('s1');
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('sets hasMore and nextCursor when an extra row is fetched', async () => {
    const t = new Date('2024-01-15T10:00:00.000Z');
    const base = {
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      carrier: null,
      service: null,
      trackingNumber: null,
      status: 'CREATED',
      shippedAt: null,
      deliveredAt: null,
      createdAt: t,
      updatedAt: t,
    };
    const list = createListShipments({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      shipments: {
        listPage: vi.fn(async () => ({
          items: [
            { ...base, id: 's1' },
            { ...base, id: 's2' },
          ],
        })),
      },
    });

    const page = await list.execute({
      tenantId: 't1',
      actorPermissions: ['shipments.read'],
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('passes filters and tenantId to the repository', async () => {
    const listPage = vi.fn(async () => ({ items: [] }));
    const list = createListShipments({
      authorization: { requirePermission: vi.fn() },
      queryable: { tag: 'q' },
      shipments: { listPage },
    });

    await list.execute({
      tenantId: 'tenant-a',
      actorPermissions: ['shipments.read'],
      orderId: 'order-1',
      status: 'CREATED',
      limit: 10,
    });

    expect(listPage).toHaveBeenCalledWith(
      { tag: 'q' },
      'tenant-a',
      expect.objectContaining({
        orderId: 'order-1',
        status: 'CREATED',
      }),
      11,
      null,
      null,
    );
  });

  it('requires shipments.read permission', async () => {
    const list = createListShipments({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      queryable: {},
      shipments: { listPage: vi.fn() },
    });

    await expect(
      list.execute({ tenantId: 't1', actorPermissions: [], limit: 10 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
