import { describe, expect, it, vi } from 'vitest';
import { DefaultReturnCommandService } from '../../../src/modules/returns/public/return-command-service.js';

const returnDetail = {
    id: 'return-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    externalReference: 'RET-1',
    shipmentId: null,
    status: 'REQUESTED',
    reason: 'Defect',
    lines: [{ orderLineId: 'line-1', quantity: 2 }],
};

describe('DefaultReturnCommandService', () => {
    it('delegates createReturn to the CreateReturn use case', async () => {
        const createReturn = {
            execute: vi.fn().mockResolvedValue({ return: returnDetail }),
        };
        const service = new DefaultReturnCommandService({ createReturn });

        const result = await service.createReturn({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['returns.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Defect',
            externalReference: 'RET-1',
        });

        expect(createReturn.execute).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 'tenant-1',
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            reason: 'Defect',
            externalReference: 'RET-1',
        }));
        expect(result).toEqual({ return: returnDetail });
    });

    it('wraps createReturn in idempotency when an idempotency key is provided', async () => {
        const createReturn = {
            execute: vi.fn().mockImplementation(async ({ transaction }) => ({
                return: { ...returnDetail, transactionProvided: transaction !== undefined },
            })),
        };
        const idempotency = {
            execute: vi.fn().mockImplementation(async (_key, _fingerprint, operation) => {
                const value = await operation({ tx: true });
                return { kind: 'executed', value };
            }),
        };
        const service = new DefaultReturnCommandService({ createReturn, idempotency });

        const result = await service.createReturn({
            tenantId: 'tenant-1',
            actorId: 'actor-1',
            actorKind: 'user',
            actorPermissions: ['returns.create'],
            orderId: 'order-1',
            lines: [{ orderLineId: 'line-1', quantity: 2 }],
            idempotencyKey: 'idem-return-1',
            principalFingerprint: 'principal-1',
            requestFingerprint: 'body-1',
        });

        expect(idempotency.execute).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            principalFingerprint: 'principal-1',
            routeId: 'returns.create',
            idempotencyKey: 'idem-return-1',
        }, 'body-1', expect.any(Function), expect.any(Function), { useTransaction: true });
        expect(result.return).toMatchObject({ transactionProvided: true });
    });
});
