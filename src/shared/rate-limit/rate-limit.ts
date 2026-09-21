/**
 * Rate limiting port.
 *
 * Counters live in Redis so every API replica shares the same budget. There is
 * deliberately no in-memory fallback: a per-process limiter silently multiplies
 * the effective limit by the replica count, which is worse than no limit at all
 * because it looks like it works.
 */

export interface RateLimitPolicy {
  /** Stable, low-cardinality name used as a metric label. */
  readonly name: string;
  /** Requests permitted per window. */
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitKey {
  readonly policy: RateLimitPolicy;
  /** What the budget is counted against: tenant, API key hash, or IP. */
  readonly subject: string;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Seconds until the window resets. */
  readonly resetSeconds: number;
  /** Seconds the caller should wait; 0 when allowed. */
  readonly retryAfterSeconds: number;
}

export interface RateLimitService {
  /** Atomically consumes one unit of budget and reports the outcome. */
  consume(key: RateLimitKey): Promise<RateLimitResult>;
  /** Reports the current state without consuming budget. */
  peek(key: RateLimitKey): Promise<RateLimitResult>;
  /** Clears a subject's counter. Intended for tests and operator tooling. */
  reset(key: RateLimitKey): Promise<void>;
}
