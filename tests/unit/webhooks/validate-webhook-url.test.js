import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { validateWebhookUrl } from '../../../src/modules/webhooks/application/validate-webhook-url.js';

describe('validateWebhookUrl', () => {
    it('accepts HTTPS URLs', () => {
        expect(validateWebhookUrl('https://example.com/webhooks/nexora')).toBe('https://example.com/webhooks/nexora');
    });

    it('rejects non-HTTPS URLs', () => {
        expect(() => validateWebhookUrl('http://example.com/hook')).toThrow(ValidationError);
    });

    it('rejects invalid URLs', () => {
        expect(() => validateWebhookUrl('not-a-url')).toThrow(ValidationError);
    });
});
