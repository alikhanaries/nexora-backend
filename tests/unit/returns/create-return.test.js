import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { createCreateReturn } from '../../../src/modules/returns/services/create-return.js';

describe('createCreateReturn', () => {
  it('rejects empty lines before touching infrastructure', async () => {
    const createReturn = createCreateReturn({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      returns: {},
      orders: {},
    });

    await expect(
      createReturn.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['returns.create'],
        orderId: 'o1',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createReturn).toHaveProperty('execute');
  });

  it('requires returns.create permission via deps.authorization', async () => {
    const requirePermission = vi.fn();
    const createReturn = createCreateReturn({
      authorization: { requirePermission },
      database: { execute: vi.fn() },
      returns: {},
      orders: {},
    });

    await expect(
      createReturn.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['returns.create'],
        orderId: 'o1',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(requirePermission).toHaveBeenCalledWith(['returns.create'], 'returns.create');
  });

  it('completes a successful create path with mocks', async () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const tx = { tag: 'tx' };
    const createReturn = createCreateReturn({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work(tx)),
      },
      returns: {
        findByExternalReference: vi.fn(),
        lockByExternalReferenceForUpdate: vi.fn(),
        sumPendingQuantitiesByOrderLine: vi.fn(async () => new Map()),
        insertReturn: vi.fn(),
        insertReturnLine: vi.fn(),
        verifyShipmentBelongsToOrder: vi.fn(),
      },
      orders: {
        findOrder: vi.fn(async () => ({ id: 'o1', tenantId: 't1' })),
        lockOrderLinesForUpdate: vi.fn(async () => [{
          id: 'line-1',
          shippedQuantity: 5,
          returnedQuantity: 0,
        }]),
      },
      externalIntegerIdMappingCommandService: {
        assignMapping: vi.fn(),
      },
      eventRecorder: {
        record: vi.fn(),
      },
    });

    const result = await createReturn.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['returns.create'],
      orderId: 'o1',
      lines: [{ orderLineId: 'line-1', quantity: 2 }],
      reason: 'Defect',
    });

    expect(result.return.orderId).toBe('o1');
    expect(result.return.status).toBe('REQUESTED');
    expect(result.return.lines).toHaveLength(1);
    expect(result.return.lines[0].orderLineId).toBe('line-1');
    expect(result.return.reason).toBe('Defect');

    vi.useRealTimers();
  });
});
