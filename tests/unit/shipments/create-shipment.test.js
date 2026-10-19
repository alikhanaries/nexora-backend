import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { createCreateShipment } from '../../../src/modules/shipments/services/create-shipment.js';

describe('createCreateShipment', () => {
  it('rejects empty lines before touching infrastructure', async () => {
    const createShipment = createCreateShipment({
      authorization: { requirePermission: vi.fn() },
      database: { execute: vi.fn() },
      shipments: {},
    });

    await expect(
      createShipment.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['shipments.create'],
        orderId: 'o1',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(createShipment).toHaveProperty('execute');
  });

  it('requires shipments.create permission via deps.authorization', async () => {
    const requirePermission = vi.fn();
    const createShipment = createCreateShipment({
      authorization: { requirePermission },
      database: { execute: vi.fn() },
      shipments: {},
    });

    await expect(
      createShipment.execute({
        tenantId: 't1',
        actorId: 'a1',
        actorKind: 'user',
        actorPermissions: ['shipments.create'],
        orderId: 'o1',
        lines: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(requirePermission).toHaveBeenCalledWith(['shipments.create'], 'shipments.create');
  });

  it('completes a successful create path with mocks', async () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const tx = { tag: 'tx' };
    const createShipment = createCreateShipment({
      authorization: { requirePermission: vi.fn() },
      database: {
        execute: vi.fn(async (work) => work(tx)),
      },
      shipments: {
        findByExternalReference: vi.fn(),
        lockByExternalReferenceForUpdate: vi.fn(),
        insertShipment: vi.fn(),
        insertShipmentLine: vi.fn(),
      },
      orderFulfillmentService: {
        lockOrderLinesForFulfillment: vi.fn(async () => [{
          id: 'line-1',
          shippableQuantity: () => 5,
        }]),
        applyShipmentQuantities: vi.fn(),
        evaluateOrderShipmentState: vi.fn(),
      },
      externalIntegerIdMappingCommandService: {
        assignMapping: vi.fn(),
      },
      eventRecorder: {
        record: vi.fn(),
      },
    });

    const result = await createShipment.execute({
      tenantId: 't1',
      actorId: 'a1',
      actorKind: 'user',
      actorPermissions: ['shipments.create'],
      orderId: 'o1',
      lines: [{ orderLineId: 'line-1', quantity: 2 }],
      carrier: 'DHL',
    });

    expect(result.shipment.orderId).toBe('o1');
    expect(result.shipment.status).toBe('CREATED');
    expect(result.shipment.lines).toHaveLength(1);
    expect(result.shipment.lines[0].orderLineId).toBe('line-1');
    expect(result.shipment.carrier).toBe('DHL');

    vi.useRealTimers();
  });
});
