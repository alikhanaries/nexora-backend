import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { createCreateCancellation } from '../../../src/modules/cancellations/services/create-cancellation.js';

describe('createCreateCancellation', () => {
  it('requires cancellations.create permission via deps.authorization', async () => {
    const requirePermission = vi.fn();
    const createCancellation = createCreateCancellation({
      authorization: { requirePermission },
      orderQueryService: {
        findOrderById: vi.fn(async () => null),
      },
      database: { execute: vi.fn() },
      cancellations: {},
    });

    await expect(
      createCancellation.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['cancellations.create'],
        orderId: 'o1',
        permission: 'cancellations.create',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(requirePermission).toHaveBeenCalledWith(['cancellations.create'], 'cancellations.create');
    expect(createCancellation).toHaveProperty('execute');
  });

  it('throws NotFoundError when order is missing', async () => {
    const createCancellation = createCreateCancellation({
      authorization: { requirePermission: vi.fn() },
      orderQueryService: {
        findOrderById: vi.fn(async () => null),
      },
      database: { execute: vi.fn() },
      cancellations: {},
    });

    await expect(
      createCancellation.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['cancellations.create'],
        orderId: 'missing',
        permission: 'cancellations.create',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('completes a successful cancellation path with mocks', async () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const tx = { tag: 'tx' };
    const createCancellation = createCreateCancellation({
      authorization: { requirePermission: vi.fn() },
      orderQueryService: {
        findOrderById: vi.fn(async () => ({ id: 'o1', tenantId: 't1', status: 'CONFIRMED' })),
      },
      database: {
        execute: vi.fn(async (work) => work(tx)),
      },
      cancellations: {
        findByExternalReference: vi.fn(),
        lockByExternalReferenceForUpdate: vi.fn(),
        insertCancellation: vi.fn(),
        insertCancellationLine: vi.fn(),
        updateCancellation: vi.fn(),
      },
      orderFulfillmentService: {
        lockOrderLinesForFulfillment: vi.fn(),
        applyCancellation: vi.fn(async () => ({
          order: { status: 'CANCELLED' },
          appliedLines: [{
            orderLineId: 'line-1',
            quantity: 1,
            stockLocationId: 'loc-1',
            productId: 'prod-1',
          }],
        })),
      },
      inventoryService: {
        release: vi.fn(),
      },
      externalIntegerIdMappingCommandService: {
        assignMapping: vi.fn(),
      },
      eventRecorder: {
        record: vi.fn(),
      },
    });

    const result = await createCancellation.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['cancellations.create'],
      orderId: 'o1',
      permission: 'cancellations.create',
      lines: [{ orderLineId: 'line-1', quantity: 1 }],
    });

    expect(result.cancellation.orderId).toBe('o1');
    expect(result.cancellation.status).toBe('COMPLETED');
    expect(result.cancellation.lines).toHaveLength(1);
    expect(result.cancellation.lines[0].orderLineId).toBe('line-1');

    vi.useRealTimers();
  });
});
