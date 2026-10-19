import { describe, expect, it } from 'vitest';
import { generateCompatV2InvoicePdf } from '../../../src/modules/compatibility/services/generate-compat-v2-invoice-pdf.js';

describe('generateCompatV2InvoicePdf', () => {
    it('returns a PDF buffer containing compat v2 invoice metadata text', () => {
        const pdf = generateCompatV2InvoicePdf({
            merchantOrderNo: 'ORD-9001',
            channelOrderNo: 'MP-9001',
            orderDate: new Date('2026-03-15T10:00:00.000Z'),
        });
        expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
        const text = pdf.toString('utf8');
        expect(text).toContain('CE-ORD-9001');
        expect(text).toContain('Invoice number');
        expect(text).toContain('15/03/2026');
    });
});
