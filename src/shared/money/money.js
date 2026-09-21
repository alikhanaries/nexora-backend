import { ValidationError } from '../errors/index.js';
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export function parseCurrency(currency) {
    const normalized = currency.trim().toUpperCase();
    if (!CURRENCY_PATTERN.test(normalized)) {
        throw new ValidationError('Currency must be a 3-letter ISO 4217 code');
    }
    return normalized;
}
export function parseAmountMinor(amountMinor) {
    if (!Number.isInteger(amountMinor)) {
        throw new ValidationError('Amount must be an integer in minor units');
    }
    if (amountMinor <= 0) {
        throw new ValidationError('Amount must be positive');
    }
    if (!Number.isSafeInteger(amountMinor)) {
        throw new ValidationError('Amount exceeds safe integer range');
    }
    return amountMinor;
}
export function createMoney(currency, amountMinor) {
    return {
        currency: parseCurrency(currency),
        amountMinor: parseAmountMinor(amountMinor),
    };
}
