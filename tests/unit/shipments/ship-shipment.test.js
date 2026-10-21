import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import { reconstituteShipment } from '../../../src/modules/shipments/models/shipment.js';
import { ShipmentStatus } from '../../../src/modules/shipments/models/shipment-status.js';
import { createShipShipment } from '../../../src/modules/shipments/services/ship-shipment.js';

function makeShipment(overrides = {}) {
  const now = new Date('2024-01-01T00:00:00.000Z');
  return reconstituteShipment({
    id: 's1',
    tenantId: 't1',
    orderId: 'o1',
    externalReference: null,
    carrier: null,
    service: null,
    trackingNumber: null,
    status: ShipmentStatus.CREATED,
    shippedAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('createShipShipment', () => {
  it('throws NotFoundError when shipment is missing', async () => {
    const shipShipment = createShipShipment({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      shipments: {
        lockShipmentForUpdate: vi.fn(async () => null),
      },
      eventRecorder: { record: vi.fn() },
      inventoryService: {},
      orderQueryService: {},
    });

    await expect(
      shipShipment.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['shipments.update'],
        shipmentId: 'missing',
        transaction: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ships a CREATED shipment and records events', async () => {
    const existing = makeShipment();
    const updateShipment = vi.fn();
    const record = vi.fn();
    const fulfillReservedForShipment = vi.fn();
    const shipShipment = createShipShipment({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      shipments: {
        lockShipmentForUpdate: vi.fn(async () => existing),
        updateShipment,
        listShipmentLines: vi.fn(async () => [{
          id: 'sl1',
          orderLineId: 'ol1',
          quantity: 1,
          tenantId: 't1',
          shipmentId: 's1',
          createdAt: existing.createdAt,
        }]),
      },
      eventRecorder: { record },
      inventoryService: {
        fulfillReservedForShipment,
      },
      orderQueryService: {
        getOrderLines: vi.fn(async () => [{
          id: 'ol1',
          productId: 'p1',
          stockLocationId: 'loc1',
        }]),
      },
    });

    const result = await shipShipment.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['shipments.update'],
      shipmentId: 's1',
      trackingNumber: 'TRACK-1',
      transaction: {},
    });

    expect(result.shipment.status).toBe(ShipmentStatus.SHIPPED);
    expect(result.shipment.trackingNumber).toBe('TRACK-1');
    expect(updateShipment).toHaveBeenCalled();
    expect(record).toHaveBeenCalled();
    expect(shipShipment).toHaveProperty('execute');
  });
});
