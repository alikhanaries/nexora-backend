import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
  createReturnQueryService,
} from '../../../src/modules/returns/services/return-query-service.js';

describe('createReturnQueryService', () => {
  it('getReturnById returns return with lines', async () => {
    const createdAt = new Date();
    const returnEntity = {
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
    };
    const service = createReturnQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      returns: {
        findById: vi.fn(async () => returnEntity),
        listReturnLines: vi.fn(async () => [{
          id: 'rl1',
          tenantId: 't1',
          returnId: 'r1',
          orderLineId: 'ol1',
          quantity: 1,
          reason: null,
          createdAt,
          updatedAt: createdAt,
        }]),
      },
    });

    const dto = await service.getReturnById('t1', 'r1');
    expect(dto.id).toBe('r1');
    expect(dto.lines).toHaveLength(1);
  });

  it('getReturnById throws NotFoundError when missing', async () => {
    const service = createReturnQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      returns: { findById: vi.fn(async () => null), listReturnLines: vi.fn() },
    });

    await expect(service.getReturnById('t1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
