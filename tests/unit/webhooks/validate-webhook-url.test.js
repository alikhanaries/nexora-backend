import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../src/shared/errors/index.js';
import { validateWebhookUrl } from '../../../src/modules/webhooks/application/validate-webhook-url.js';

describe('validateWebhookUrl', () => {
    it('accepts HTTPS URLs that pass SSRF validation', async () => {
        await expect(validateWebhookUrl('https://example.com/webhooks/nexora'))
            .resolves.toBe('https://example.com/webhooks/nexora');
    });

    it('rejects non-HTTPS URLs', async () => {
        await expect(validateWebhookUrl('http://example.com/hook')).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects invalid URLs', async () => {
        await expect(validateWebhookUrl('not-a-url')).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects localhost destinations', async () => {
        await expect(validateWebhookUrl('https://localhost/hook')).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects URLs with embedded credentials', async () => {
        await expect(validateWebhookUrl('https://user:pass@example.com/hook')).rejects.toBeInstanceOf(ValidationError);
    });
});
