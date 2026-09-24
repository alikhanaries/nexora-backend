import { CATALOG_SYNC_RATE_LIMIT_POLICY } from '../../../shared/auth/rate-limit-policies.js';

/**
 * Per-(tenant, channel) Redis rate limit for outbound catalog sync (ADR-028 §13).
 */
export class ChannelCatalogSyncRateLimiter {
    rateLimiter;

    /**
     * @param {object} deps
     * @param {import('../../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
     */
    constructor(deps) {
        this.rateLimiter = deps.rateLimiter;
    }

    /**
     * @param {string} tenantId
     * @param {string} channelId
     */
    async consume(tenantId, channelId) {
        return this.rateLimiter.consume({
            policy: CATALOG_SYNC_RATE_LIMIT_POLICY,
            subject: `${tenantId}:${channelId}`,
        });
    }
}
