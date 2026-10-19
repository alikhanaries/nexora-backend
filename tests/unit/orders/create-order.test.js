import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { createCreateOrder } from '../../../src/modules/orders/services/create-order.js';

describe('createCreateOrder', () => {
  it('rejects empty lines before touching infrastructure', async () => {
    const createOrder = createCreateOrder({
      authorization: { requirePermission: vi.fn() },
      commerceIntegrationQueryService: { verifyChannelUsable: vi.fn() },
      database: { withTenant: vi.fn(), execute: vi.fn() },
      orders: {},
    });

    await expect(
      createOrder.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['orders.create'],
        channelId: 'ch-1',
        currency: 'USD',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createOrder).toHaveProperty('execute');
  });

  it('requires orders.create permission via deps.authorization', async () => {
    const requirePermission = vi.fn();
    const createOrder = createCreateOrder({
      authorization: { requirePermission },
      commerceIntegrationQueryService: { verifyChannelUsable: vi.fn() },
      database: {
        withTenant: vi.fn(async (_tenantId, fn) => fn({})),
        execute: vi.fn(),
      },
      productQueryService: {},
      offerQueryService: {},
      pricingService: {},
      inventoryService: { reserve: vi.fn() },
      orders: {
        allocateOrderNumber: vi.fn(),
        insertOrder: vi.fn(),
        insertOrderLine: vi.fn(),
        insertCustomerSnapshot: vi.fn(),
      },
      eventRecorder: { record: vi.fn() },
      externalIntegerIdMappingCommandService: {},
    });

    await expect(
      createOrder.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['orders.create'],
        channelId: 'ch-1',
        currency: 'USD',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(requirePermission).toHaveBeenCalledWith(['orders.create'], 'orders.create');
  });
});
