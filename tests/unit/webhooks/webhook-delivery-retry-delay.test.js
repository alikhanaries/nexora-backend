import { describe, expect, it } from 'vitest';
import { resolveWebhookRetryDelayMs } from '../../../src/modules/webhooks/application/webhook-delivery-retry-delay.js';

describe('resolveWebhookRetryDelayMs', () => {
    it('returns null when Retry-After is absent', () => {
        expect(resolveWebhookRetryDelayMs(null, 3_600)).toBeNull();
    });

    it('converts seconds to milliseconds', () => {
        expect(resolveWebhookRetryDelayMs(60, 3_600)).toBe(60_000);
    });

    it('caps delay at the configured maximum', () => {
        expect(resolveWebhookRetryDelayMs(9_999, 120)).toBe(120_000);
    });
});
