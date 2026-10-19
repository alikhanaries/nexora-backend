import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createGetReturn } from '../../../src/modules/returns/services/get-return.js';

describe('createGetReturn', () => {
  it('returns return from the query service', async () => {
    const returnDetail = { id: 'r1', tenantId: 't1', orderId: 'o1', lines: [] };
    const getReturn = createGetReturn({
      authorization: { requirePermission: vi.fn() },
      returnQueryService: {
        getReturnById: vi.fn(async () => returnDetail),
      },
    });

    const result = await getReturn.execute({
      tenantId: 't1',
      returnId: 'r1',
      actorPermissions: ['returns.read'],
    });

    expect(result.return.id).toBe('r1');
    expect(getReturn).toHaveProperty('execute');
  });

  it('requires returns.read permission', async () => {
    const getReturn = createGetReturn({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      returnQueryService: {
        getReturnById: vi.fn(),
      },
    });

    await expect(
      getReturn.execute({
        tenantId: 't1',
        returnId: 'r1',
        actorPermissions: [],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
