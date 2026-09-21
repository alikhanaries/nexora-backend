import { ValidationError } from '../errors/index.js';
const DEFAULT_POLICY = {
    minLength: 12,
    maxLength: 128,
};
export function validatePassword(password, config = DEFAULT_POLICY) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new ValidationError('Password is required');
    }
    if (password.length < config.minLength) {
        throw new ValidationError(`Password must be at least ${config.minLength} characters`);
    }
    if (password.length > config.maxLength) {
        throw new ValidationError(`Password must not exceed ${config.maxLength} characters`);
    }
}
export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
export function normalizeTenantSlug(slug) {
    return slug.trim().toLowerCase();
}
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function validateTenantSlug(slug) {
    const normalized = normalizeTenantSlug(slug);
    if (!SLUG_PATTERN.test(normalized)) {
        throw new ValidationError('Tenant slug must be lowercase alphanumeric with optional hyphens');
    }
}
