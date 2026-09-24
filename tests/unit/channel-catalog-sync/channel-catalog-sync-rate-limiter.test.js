import { describe, expect, it, vi } from 'vitest';
import { ChannelCatalogSyncRateLimiter } from '../../../src/modules/channel-catalog-sync/application/channel-catalog-sync-rate-limiter.js';
import { CATALOG_SYNC_RATE_LIMIT_POLICY } from '../../../src/shared/auth/rate-limit-policies.js';

describe('ChannelCatalogSyncRateLimiter', () => {
    it('scopes rate limits per tenant and channel', async () => {
        const consume = vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
        const limiter = new ChannelCatalogSyncRateLimiter({ rateLimiter: { consume } });
        await limiter.consume('tenant-a', 'channel-1');
        await limiter.consume('tenant-b', 'channel-1');
        expect(consume).toHaveBeenNthCalledWith(1, {
            policy: CATALOG_SYNC_RATE_LIMIT_POLICY,
            subject: 'tenant-a:channel-1',
        });
        expect(consume).toHaveBeenNthCalledWith(2, {
            policy: CATALOG_SYNC_RATE_LIMIT_POLICY,
            subject: 'tenant-b:channel-1',
        });
    });
});
