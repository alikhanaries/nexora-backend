import { describe, expect, it, vi } from 'vitest';
import { DefaultCancellationCommandService } from '../../../src/modules/cancellations/public/cancellation-command-service.js';

const cancellationDetail = {
    id: 'cancellation-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    externalReference: 'CAN-1',
    status: 'COMPLETED',
    reason: 'Customer request',
    lines: [{ orderLineId: 'line-1', quantity: 2 }],
};

describe('DefaultCancellationCommandService', () => {
    it('delegates createCancellation to the CreateCancellation use case', async () => {
        const createCancellation = {
            execute: vi.fn().mockResolvedValue({ cancellation: cancellationDetail }),
        };
        const service = new DefaultCancellationCommandService({ createCancellation });

        const result = await service.createCancellation({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['cancellations.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Customer request',
            externalReference: 'CAN-1',
        });

        expect(createCancellation.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            orderId: 'order-1',
            permission: 'cancellations.create',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Customer request',
            externalReference: 'CAN-1',
        }));
        expect(result).toEqual({ cancellation: cancellationDetail });
    });

    it('wraps createCancellation in idempotency when an idempotency key is provided', async () => {
        const createCancellation = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                cancellation: { ...cancellationDetail, transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultCancellationCommandService({ createCancellation, idempotency });

        const result = await service.createCancellation({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['cancellations.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            idempotencyKey: 'idem-cancel-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'cancellations.create',
            idempotencyKey: 'idem-cancel-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(result.cancellation).toMatchObject({ transactionProvided: true });
    });
});
