/**
 * Rate limiting port.
 *
 * Counters live in Redis so every API replica shares the same budget. There is
 * deliberately no in-memory fallback: a per-process limiter silently multiplies
 * the effective limit by the replica count, which is worse than no limit at all
 * because it looks like it works.
 */
export {};
