import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createGetCancellation } from '../../../src/modules/cancellations/services/get-cancellation.js';

describe('createGetCancellation', () => {
  it('returns cancellation from the query service', async () => {
    const cancellation = { id: 'c1', tenantId: 't1', orderId: 'o1', lines: [] };
    const getCancellation = createGetCancellation({
      authorization: { requirePermission: vi.fn() },
      cancellationQueryService: {
        getCancellationById: vi.fn(async () => cancellation),
      },
    });

    const result = await getCancellation.execute({
      tenantId: 't1',
      cancellationId: 'c1',
      actorPermissions: ['cancellations.read'],
    });

    expect(result.cancellation.id).toBe('c1');
    expect(getCancellation).toHaveProperty('execute');
  });

  it('requires cancellations.read permission', async () => {
    const getCancellation = createGetCancellation({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      cancellationQueryService: {
        getCancellationById: vi.fn(),
      },
    });

    await expect(
      getCancellation.execute({
        tenantId: 't1',
        cancellationId: 'c1',
        actorPermissions: [],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
