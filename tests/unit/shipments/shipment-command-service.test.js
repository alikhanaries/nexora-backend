import { describe, expect, it, vi } from 'vitest';
import { DefaultShipmentCommandService } from '../../../src/modules/shipments/public/shipment-command-service.js';

const shipmentDetail = {
    id: 'shipment-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    carrier: 'DHL',
    service: null,
    trackingNumber: 'TRACK-1',
    status: 'CREATED',
    lines: [{ orderLineId: 'line-1', quantity: 2 }],
};

describe('DefaultShipmentCommandService', () => {
    it('delegates createShipment to the CreateShipment use case', async () => {
        const createShipment = {
            execute: vi.fn().mockResolvedValue({ shipment: shipmentDetail }),
        };
        const service = new DefaultShipmentCommandService({ createShipment });

        const result = await service.createShipment({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['shipments.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            carrier: 'DHL',
            trackingNumber: 'TRACK-1',
        });

        expect(createShipment.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            carrier: 'DHL',
            trackingNumber: 'TRACK-1',
        }));
        expect(result).toEqual({ shipment: shipmentDetail });
    });

    it('wraps createShipment in idempotency when an idempotency key is provided', async () => {
        const createShipment = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                shipment: { ...shipmentDetail, transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultShipmentCommandService({ createShipment, idempotency });

        const result = await service.createShipment({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['shipments.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            idempotencyKey: 'idem-ship-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'shipments.create',
            idempotencyKey: 'idem-ship-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(result.shipment).toMatchObject({ transactionProvided: true });
    });
});
