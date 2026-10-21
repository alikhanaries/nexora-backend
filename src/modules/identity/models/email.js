import { ValidationError } from '../../../shared/errors/index.js';
import { normalizeEmail } from '../../../shared/security/index.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {{ raw: string, normalized: string }} EmailValue
 */

/**
 * @param {{ raw: string, normalized: string }} props
 * @returns {EmailValue}
 */
export function reconstituteEmail(props) {
    return {
        raw: props.raw,
        normalized: props.normalized,
    };
}

/**
 * Validates and normalizes a user-supplied email address.
 * @param {string} email
 * @returns {EmailValue}
 */
export function parseEmail(email) {
    if (typeof email !== 'string' || email.trim().length === 0) {
        throw new ValidationError('Email is required');
    }
    const raw = email.trim();
    const normalized = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalized)) {
        throw new ValidationError('Email format is invalid');
    }
    return reconstituteEmail({ raw, normalized });
}
