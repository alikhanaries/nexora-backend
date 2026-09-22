import { compatibilityRateLimitSubject } from '../../../shared/auth/compatibility-rate-limit-subject.js';
import { RateLimitError } from '../../../shared/errors/index.js';

/**
 * @param {{
 *   rateLimiter: import('../../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter,
 *   actor: { tenantId: string, kind: string, userId?: string, apiKeyId?: string, id?: string },
 *   policy: { name: string, limit: number, windowSeconds: number },
 *   category: 'read'|'mutation',
 * }} input
 */
export async function enforceCompatibilityRateLimit(input) {
    const result = await input.rateLimiter.consume({
        policy: input.policy,
        subject: compatibilityRateLimitSubject(input.actor, input.category),
    });
    if (!result.allowed) {
        throw new RateLimitError(result.retryAfterSeconds);
    }
    return result;
}
