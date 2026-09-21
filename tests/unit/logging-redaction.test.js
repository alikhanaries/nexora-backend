import { describe, expect, it } from 'vitest';
import { maskEmail, redactDeep, REDACTED } from '../../src/shared/logging/index.js';
describe('log redaction', () => {
    it('redacts sensitive keys', () => {
        const redacted = redactDeep({ password: 'secret', apiKey: 'abc' });
        expect(redacted['password']).toBe(REDACTED);
        expect(redacted['apiKey']).toBe(REDACTED);
    });
    it('masks email addresses', () => {
        expect(maskEmail('john@example.com')).toBe('j***@example.com');
    });
});
