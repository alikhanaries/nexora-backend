import { ValidationError } from '../errors/index.js';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface Money {
  readonly currency: string;
  readonly amountMinor: number;
}

export function parseCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new ValidationError('Currency must be a 3-letter ISO 4217 code');
  }
  return normalized;
}

export function parseAmountMinor(amountMinor: number): number {
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

export function createMoney(currency: string, amountMinor: number): Money {
  return {
    currency: parseCurrency(currency),
    amountMinor: parseAmountMinor(amountMinor),
  };
}
