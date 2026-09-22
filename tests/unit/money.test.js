import { describe, expect, it } from 'vitest';
import { createMoney, getCurrencyMinorUnitExponent, minorUnitsToDecimal, parseCurrency } from '../../src/shared/money/index.js';
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
    it('defaults unknown currencies to a 2-decimal minor-unit exponent', () => {
        expect(getCurrencyMinorUnitExponent('USD')).toBe(2);
        expect(getCurrencyMinorUnitExponent('EUR')).toBe(2);
    });
    it('converts standard 2-decimal currency minor units to decimal', () => {
        expect(minorUnitsToDecimal('USD', 2500)).toBe(25);
        expect(minorUnitsToDecimal('USD', 1999)).toBe(19.99);
    });
    it('converts zero minor units to zero decimal', () => {
        expect(minorUnitsToDecimal('USD', 0)).toBe(0);
        expect(minorUnitsToDecimal('JPY', 0)).toBe(0);
    });
    it('converts zero-exponent currency minor units without dividing by 100', () => {
        expect(getCurrencyMinorUnitExponent('JPY')).toBe(0);
        expect(minorUnitsToDecimal('JPY', 1500)).toBe(1500);
    });
    it('converts 3-decimal currency minor units correctly', () => {
        expect(getCurrencyMinorUnitExponent('KWD')).toBe(3);
        expect(minorUnitsToDecimal('KWD', 1050)).toBe(1.05);
    });
    it('rejects negative minor units for decimal conversion', () => {
        expect(() => minorUnitsToDecimal('USD', -1)).toThrow(ValidationError);
    });
});
