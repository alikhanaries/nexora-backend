import { describe, expect, it } from 'vitest';
import { normalizeMerchantSku } from '../../../src/modules/products/domain/merchant-sku.js';
import { ValidationError } from '../../../src/shared/errors/index.js';
describe('merchant SKU', () => {
    it('trims whitespace without lowercasing', () => {
        expect(normalizeMerchantSku('  ABC-123  ')).toBe('ABC-123');
    });
    it('rejects empty SKU', () => {
        expect(() => normalizeMerchantSku('   ')).toThrow(ValidationError);
    });
});
