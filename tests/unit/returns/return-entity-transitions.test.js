import { describe, expect, it } from 'vitest';
import { BusinessRuleError } from '../../../src/shared/errors/index.js';
import {
    approveReturnEntity,
    createReturnEntity,
    receiveReturnEntity,
} from '../../../src/modules/returns/models/return.js';
import { ReturnStatus } from '../../../src/modules/returns/models/return-status.js';

describe('return entity transitions', () => {
    const base = createReturnEntity({
        id: 'return-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        externalReference: null,
        shipmentId: null,
        reason: 'damaged',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    it('approves a requested return', () => {
        const at = new Date('2026-02-01T00:00:00.000Z');
        const approved = approveReturnEntity(base, at);
        expect(approved.status).toBe(ReturnStatus.APPROVED);
        expect(approved.updatedAt).toEqual(at);
    });

    it('rejects duplicate transition to the same status', () => {
        const approved = approveReturnEntity(base);
        expect(() => approveReturnEntity(approved)).toThrow(BusinessRuleError);
    });

    it('records receivedAt when marking received', () => {
        const approved = approveReturnEntity(base);
        const at = new Date('2026-03-01T00:00:00.000Z');
        const received = receiveReturnEntity(approved, at);
        expect(received.status).toBe(ReturnStatus.RECEIVED);
        expect(received.receivedAt).toEqual(at);
    });
});
