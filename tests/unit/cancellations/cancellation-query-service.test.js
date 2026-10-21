import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
  createCancellationQueryService,
} from '../../../src/modules/cancellations/services/cancellation-query-service.js';

describe('createCancellationQueryService', () => {
  it('getCancellationById returns cancellation with lines', async () => {
    const cancellation = {
      id: 'c1',
      tenantId: 't1',
      orderId: 'o1',
      status: 'COMPLETED',
      createdAt: new Date(),
    };
    const service = createCancellationQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      cancellations: {
        findById: vi.fn(async () => cancellation),
        listLines: vi.fn(async () => [{ id: 'cl1', orderLineId: 'ol1', quantity: 1 }]),
      },
    });

    const dto = await service.getCancellationById('t1', 'c1');
    expect(dto.id).toBe('c1');
    expect(dto.lines).toHaveLength(1);
  });

  it('getCancellationById throws NotFoundError when missing', async () => {
    const service = createCancellationQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      cancellations: { findById: vi.fn(async () => null), listLines: vi.fn() },
    });

    await expect(service.getCancellationById('t1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
