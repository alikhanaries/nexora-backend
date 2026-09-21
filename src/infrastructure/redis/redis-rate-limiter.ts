import type { Logger } from '../../shared/logging/index.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';
import type {
  RateLimitKey,
  RateLimitResult,
  RateLimitService,
} from '../../shared/rate-limit/index.js';
import type { RedisConnection } from './redis-client.js';
import type { RedisKeyBuilder } from './redis-keys.js';

/**
 * GCRA (generic cell rate algorithm) rate limiter.
 *
 * Why this shape:
 *
 * - **Atomic.** The whole decision runs in one Lua script, so concurrent
 *   requests cannot both read "9 of 10 used" and both be allowed.
 * - **One clock.** The script reads Redis's own `TIME`, not each replica's
 *   wall clock, so 10 API pods share one consistent budget even with skewed
 *   local clocks. This is what makes the limit horizontally correct.
 * - **Self-expiring.** The key's PX is exactly the drain time, so idle
 *   subjects cost nothing and no cleanup job is needed.
 * - **Exact retry-after.** GCRA tracks the theoretical arrival time, which
 *   yields the precise wait instead of "try again next window".
 *
 * There is no in-memory fallback by design: a per-process limiter multiplies
 * the real limit by the replica count while appearing to work.
 *
 * Script contract:
 *   KEYS[1] = counter key
 *   ARGV[1] = limit (requests per period)
 *   ARGV[2] = period in milliseconds
 *   ARGV[3] = cost (0 to peek without consuming)
 * Returns: { allowed, remaining, retryAfterMs, resetMs }
 */
const GCRA_SCRIPT = `
local key    = KEYS[1]
local limit  = tonumber(ARGV[1])
local period = tonumber(ARGV[2])
local cost   = tonumber(ARGV[3])

local time = redis.call('TIME')
local now  = (tonumber(time[1]) * 1000) + (tonumber(time[2]) / 1000)

local emission = period / limit
local tat = tonumber(redis.call('GET', key))
if tat == nil or tat < now then
  tat = now
end

if cost == 0 then
  local remaining = math.floor((period - (tat - now)) / emission)
  if remaining < 0 then remaining = 0 end
  return { 1, remaining, 0, math.ceil(tat - now) }
end

local new_tat  = tat + (emission * cost)
local allow_at = new_tat - period

if now < allow_at then
  return { 0, 0, math.ceil(allow_at - now), math.ceil(tat - now) }
end

local ttl = math.ceil(new_tat - now)
redis.call('SET', key, new_tat, 'PX', ttl)

local remaining = math.floor((period - (new_tat - now)) / emission)
if remaining < 0 then remaining = 0 end

return { 1, remaining, 0, ttl }
`;

/** ioredis returns `unknown` from EVAL, so the reply is narrowed explicitly. */
function parseScriptReply(reply: unknown, limit: number): Omit<RateLimitResult, 'limit'> {
  if (!Array.isArray(reply) || reply.length < 4) {
    throw new Error('Unexpected rate limiter script reply');
  }

  const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value));

  const allowed = toNumber(reply[0]) === 1;
  const remaining = toNumber(reply[1]);
  const retryAfterMs = toNumber(reply[2]);
  const resetMs = toNumber(reply[3]);

  return {
    allowed,
    remaining: Math.max(0, Math.min(remaining, limit)),
    resetSeconds: Math.max(0, Math.ceil(resetMs / 1_000)),
    // Round up so a client never retries a fraction of a second too early.
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1_000)),
  };
}

export class RedisRateLimiter implements RateLimitService {
  private readonly logger: Logger;

  constructor(
    private readonly connection: RedisConnection,
    private readonly keys: RedisKeyBuilder,
    private readonly metrics: MetricsRecorder,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: 'rate-limiter' });
  }

  async consume(key: RateLimitKey): Promise<RateLimitResult> {
    const result = await this.evaluate(key, 1);
    this.metrics.recordRateLimitHit(key.policy.name, result.allowed);

    if (!result.allowed) {
      this.logger.debug(
        { policy: key.policy.name, retryAfterSeconds: result.retryAfterSeconds },
        'Rate limit exceeded',
      );
    }
    return result;
  }

  async peek(key: RateLimitKey): Promise<RateLimitResult> {
    return this.evaluate(key, 0);
  }

  async reset(key: RateLimitKey): Promise<void> {
    await this.connection.run('ratelimit.reset', () =>
      this.connection.client.del(this.keys.rateLimit(key.policy.name, key.subject)),
    );
  }

  private async evaluate(key: RateLimitKey, cost: number): Promise<RateLimitResult> {
    const { limit, windowSeconds } = key.policy;
    if (limit <= 0 || windowSeconds <= 0) {
      throw new Error(`Rate limit policy "${key.policy.name}" must have positive limit and window`);
    }

    const reply = await this.connection.run('ratelimit.consume', () =>
      this.connection.client.eval(
        GCRA_SCRIPT,
        1,
        this.keys.rateLimit(key.policy.name, key.subject),
        limit,
        windowSeconds * 1_000,
        cost,
      ),
    );

    return { limit, ...parseScriptReply(reply, limit) };
  }
}
