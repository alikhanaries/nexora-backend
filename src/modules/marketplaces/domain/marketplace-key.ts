import { ValidationError } from '../../../shared/errors/index.js';

const MARKETPLACE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function normalizeMarketplaceKey(key: string): string {
  return key.trim().toLowerCase();
}

export function validateMarketplaceKey(key: string): void {
  const normalized = normalizeMarketplaceKey(key);
  if (!MARKETPLACE_KEY_PATTERN.test(normalized)) {
    throw new ValidationError(
      'Marketplace key must start with a letter and contain only lowercase letters, digits, and underscores',
    );
  }
}
