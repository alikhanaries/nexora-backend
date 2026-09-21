import { describe, expect, it } from 'vitest';
import { createMoney, parseCurrency } from '../../src/shared/money/index.js';
import { ValidationError } from '../../src/shared/errors/index.js';
describe('money', () => {
    it('normalizes currency to uppercase ISO code', () => {
        expect(parseCurrency('usd')).toBe('USD');
    });
    it('rejects invalid currency', () => {
        expect(() => parseCurrency('US')).toThrow(ValidationError);
    });
    it('creates money with positive minor units', () => {
        const money = createMoney('EUR', 1000);
        expect(money.currency).toBe('EUR');
        expect(money.amountMinor).toBe(1000);
    });
    it('rejects non-integer minor units', () => {
        expect(() => createMoney('USD', 10.5)).toThrow(ValidationError);
    });
});
