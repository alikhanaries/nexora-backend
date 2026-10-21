import { ValidationError } from '../../../shared/errors/index.js';
const MARKETPLACE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
/**
 * Trims and lowercases marketplace key used for adapter routing and catalog rows.
 */
export function normalizeMarketplaceKey(key) {
    return key.trim().toLowerCase();
}
/**
 * Validates normalized key pattern; throws ValidationError when invalid.
 */
export function validateMarketplaceKey(key) {
    const normalized = normalizeMarketplaceKey(key);
    if (!MARKETPLACE_KEY_PATTERN.test(normalized)) {
        throw new ValidationError('Marketplace key must start with a letter and contain only lowercase letters, digits, and underscores');
    }
}
