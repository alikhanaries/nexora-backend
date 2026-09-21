import { ValidationError } from '../../../shared/errors/index.js';
/** Preserves merchant casing; trim only. */
export function normalizeMerchantSku(raw) {
    const normalized = raw.trim();
    validateMerchantSku(normalized);
    return normalized;
}
export function validateMerchantSku(sku) {
    if (sku.length === 0) {
        throw new ValidationError('Merchant SKU is required');
    }
    if (sku.length > 128) {
        throw new ValidationError('Merchant SKU must be at most 128 characters');
    }
}
