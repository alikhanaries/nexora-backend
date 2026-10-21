import { describe, expect, it } from 'vitest';
import { parseEmail } from '../../../src/modules/identity/models/email.js';
import { normalizeEmail } from '../../../src/shared/security/index.js';
describe('Email normalization', () => {
    it('trims and lowercases via normalizeEmail', () => {
        expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });
    it('creates Email value object with normalized form', () => {
        const email = parseEmail('  Admin@Corp.io ');
        expect(email.raw).toBe('Admin@Corp.io');
        expect(email.normalized).toBe('admin@corp.io');
    });
    it('rejects invalid email format', () => {
        expect(() => parseEmail('not-an-email')).toThrow(/invalid/i);
    });
    it('rejects empty email', () => {
        expect(() => parseEmail('   ')).toThrow(/required/i);
    });
});
