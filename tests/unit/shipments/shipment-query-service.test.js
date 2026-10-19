import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../src/shared/errors/index.js';
import {
  createShipmentQueryService,
  DefaultShipmentQueryService,
} from '../../../src/modules/shipments/services/shipment-query-service.js';

describe('createShipmentQueryService', () => {
  it('getShipmentById returns shipment with lines', async () => {
    const createdAt = new Date();
    const shipment = {
      id: 's1',
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      carrier: null,
      service: null,
      trackingNumber: null,
      status: 'CREATED',
      shippedAt: null,
      deliveredAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const service = createShipmentQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      shipments: {
        findById: vi.fn(async () => shipment),
        listShipmentLines: vi.fn(async () => [{
          id: 'sl1',
          tenantId: 't1',
          shipmentId: 's1',
          orderLineId: 'ol1',
          quantity: 1,
          createdAt,
        }]),
      },
    });

    const dto = await service.getShipmentById('t1', 's1');
    expect(dto.id).toBe('s1');
    expect(dto.lines).toHaveLength(1);
  });

  it('getShipmentById throws NotFoundError when missing', async () => {
    const service = createShipmentQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      shipments: { findById: vi.fn(async () => null), listShipmentLines: vi.fn() },
    });

    await expect(service.getShipmentById('t1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('keeps DefaultShipmentQueryService constructor-return wrapper working', async () => {
    const createdAt = new Date();
    const shipment = {
      id: 's1',
      tenantId: 't1',
      orderId: 'o1',
      externalReference: null,
      carrier: null,
      service: null,
      trackingNumber: null,
      status: 'CREATED',
      shippedAt: null,
      deliveredAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const service = new DefaultShipmentQueryService({
      authorization: { requirePermission: vi.fn() },
      queryable: {},
      shipments: {
        findById: vi.fn(async () => shipment),
        listShipmentLines: vi.fn(async () => []),
      },
    });

    const dto = await service.getShipmentById('t1', 's1');
    expect(dto.id).toBe('s1');
  });
});
