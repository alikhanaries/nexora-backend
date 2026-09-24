import { describe, expect, it } from 'vitest';
import { sanitizeMarketplaceConnectionTestError } from '../../../src/modules/marketplaces/application/sanitize-marketplace-connection-test-error.js';

describe('sanitizeMarketplaceConnectionTestError', () => {
    it('redacts obvious secret patterns', () => {
        const message = sanitizeMarketplaceConnectionTestError(new Error('Failed with access_token=shpat_abc123'));
        expect(message).not.toContain('shpat_');
        expect(message).toContain('[REDACTED]');
    });

    it('redacts PEM private key fragments', () => {
        const message = sanitizeMarketplaceConnectionTestError(new Error('bad key -----BEGIN RSA PRIVATE KEY-----abc'));
        expect(message).not.toContain('BEGIN RSA PRIVATE KEY');
        expect(message).toContain('[REDACTED]');
    });

    it('truncates long messages', () => {
        const message = sanitizeMarketplaceConnectionTestError(new Error('x'.repeat(600)));
        expect(message.length).toBeLessThanOrEqual(501);
    });
});
