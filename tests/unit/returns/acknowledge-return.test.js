import { describe, expect, it, vi } from 'vitest';
import { BusinessRuleError, NotFoundError } from '../../../src/shared/errors/index.js';
import { createReturnEntity } from '../../../src/modules/returns/models/return.js';
import { ReturnStatus } from '../../../src/modules/returns/models/return-status.js';
import { createAcknowledgeReturn } from '../../../src/modules/returns/services/acknowledge-return.js';

function makeRequestedReturn() {
  const createdAt = new Date('2024-01-15T10:00:00.000Z');
  return createReturnEntity({
    id: 'r1',
    tenantId: 't1',
    orderId: 'o1',
    externalReference: null,
    shipmentId: null,
    reason: null,
    status: ReturnStatus.REQUESTED,
    createdAt,
    updatedAt: createdAt,
  });
}

describe('createAcknowledgeReturn', () => {
  it('approves a REQUESTED return', async () => {
    const existing = makeRequestedReturn();
    const acknowledgeReturn = createAcknowledgeReturn({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work({ tag: 'tx' })),
      },
      returns: {
        lockForUpdate: vi.fn(async () => existing),
        listReturnLines: vi.fn(async () => []),
        updateReturn: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
    });

    const result = await acknowledgeReturn.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['returns.update'],
      returnId: 'r1',
    });

    expect(result.return.status).toBe(ReturnStatus.APPROVED);
    expect(acknowledgeReturn).toHaveProperty('execute');
  });

  it('is idempotent when return is already APPROVED', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const existing = createReturnEntity({
      id: 'r1',
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      shipmentId: null,
      reason: null,
      status: ReturnStatus.APPROVED,
      createdAt,
      updatedAt: createdAt,
    });
    const updateReturn = vi.fn();
    const acknowledgeReturn = createAcknowledgeReturn({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work({ tag: 'tx' })),
      },
      returns: {
        lockForUpdate: vi.fn(async () => existing),
        listReturnLines: vi.fn(async () => []),
        updateReturn,
      },
      eventRecorder: { record: vi.fn() },
    });

    const result = await acknowledgeReturn.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['returns.update'],
      returnId: 'r1',
    });

    expect(result.return.status).toBe(ReturnStatus.APPROVED);
    expect(updateReturn).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when return is missing', async () => {
    const acknowledgeReturn = createAcknowledgeReturn({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work({ tag: 'tx' })),
      },
      returns: {
        lockForUpdate: vi.fn(async () => null),
        listReturnLines: vi.fn(),
        updateReturn: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
    });

    await expect(
      acknowledgeReturn.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['returns.update'],
        returnId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects acknowledge from a non-REQUESTED status that is not already handled', async () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const existing = createReturnEntity({
      id: 'r1',
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      shipmentId: null,
      reason: null,
      status: ReturnStatus.REJECTED,
      createdAt,
      updatedAt: createdAt,
    });
    const acknowledgeReturn = createAcknowledgeReturn({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work({ tag: 'tx' })),
      },
      returns: {
        lockForUpdate: vi.fn(async () => existing),
        listReturnLines: vi.fn(async () => []),
        updateReturn: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
    });

    await expect(
      acknowledgeReturn.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['returns.update'],
        returnId: 'r1',
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
