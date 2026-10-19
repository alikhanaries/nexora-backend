import { describe, expect, it, vi } from 'vitest';
import { AuthorizationError } from '../../../src/shared/errors/index.js';
import { createGetShipment } from '../../../src/modules/shipments/services/get-shipment.js';

describe('createGetShipment', () => {
  it('returns shipment from the query service', async () => {
    const shipment = { id: 's1', tenantId: 't1', orderId: 'o1', lines: [] };
    const getShipment = createGetShipment({
      authorization: { requirePermission: vi.fn() },
      shipmentQueryService: {
        getShipmentById: vi.fn(async () => shipment),
      },
    });

    const result = await getShipment.execute({
      tenantId: 't1',
      shipmentId: 's1',
      actorPermissions: ['shipments.read'],
    });

    expect(result.shipment.id).toBe('s1');
    expect(getShipment).toHaveProperty('execute');
  });

  it('requires shipments.read permission', async () => {
    const getShipment = createGetShipment({
      authorization: {
        requirePermission: vi.fn(() => {
          throw new AuthorizationError('missing permission');
        }),
      },
      shipmentQueryService: {
        getShipmentById: vi.fn(),
      },
    });

    await expect(
      getShipment.execute({
        tenantId: 't1',
        shipmentId: 's1',
        actorPermissions: [],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
