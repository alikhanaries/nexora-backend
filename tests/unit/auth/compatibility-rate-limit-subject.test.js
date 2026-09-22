import { describe, expect, it } from 'vitest';
import { compatibilityRateLimitSubject } from '../../../src/shared/auth/compatibility-rate-limit-subject.js';

describe('compatibilityRateLimitSubject', () => {
    it('scopes limits by tenant and user principal', () => {
        const subject = compatibilityRateLimitSubject({
            tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        }, 'read');
        expect(subject).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:user:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:read');
    });

    it('scopes limits by tenant and api-key principal', () => {
        const subject = compatibilityRateLimitSubject({
            tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            apiKeyId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        }, 'mutation');
        expect(subject).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:api-key:cccccccc-cccc-cccc-cccc-cccccccccccc:mutation');
    });

    it('isolates tenants with the same principal id shape', () => {
        const tenantA = compatibilityRateLimitSubject({
            tenantId: '11111111-1111-1111-1111-111111111111',
            apiKeyId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        }, 'read');
        const tenantB = compatibilityRateLimitSubject({
            tenantId: '22222222-2222-2222-2222-222222222222',
            apiKeyId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        }, 'read');
        expect(tenantA).not.toBe(tenantB);
    });
});
