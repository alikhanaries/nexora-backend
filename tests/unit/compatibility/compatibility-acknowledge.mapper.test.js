import { describe, expect, it } from 'vitest';
import {
    fingerprintAcknowledgeCommand,
    mapAcknowledgeResultToExternalResponse,
    mapExternalAcknowledgeRequest,
} from '../../../src/modules/compatibility/application/mappers/compatibility-acknowledge.mapper.js';

describe('compatibility acknowledge mapper', () => {
    it('maps MerchantOrderNo to Nexora orderNumber', () => {
        expect(mapExternalAcknowledgeRequest({
            MerchantOrderNo: ' ORD-1001 ',
            OrderId: 12345,
        })).toEqual({ orderNumber: 'ORD-1001' });
    });

    it('builds external success response', () => {
        expect(mapAcknowledgeResultToExternalResponse({
            order: { orderNumber: 'ORD-1001', status: 'CONFIRMED' },
        })).toEqual({
            Success: true,
            StatusCode: 201,
            Message: null,
        });
    });

    it('fingerprints by order number only', () => {
        const fingerprint = fingerprintAcknowledgeCommand({ orderNumber: 'ORD-1001' });
        expect(fingerprint).toBe(JSON.stringify({ orderNumber: 'ORD-1001' }));
        expect(fingerprint).not.toContain('12345');
    });
});
