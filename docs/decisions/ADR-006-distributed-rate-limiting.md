# ADR-006: Distributed Rate Limiting

## Status

Accepted — implemented in Phase 1.

## Context

Rate limits must be consistent across horizontally scaled API replicas. In-memory limiters multiply effective limits by replica count.

## Decision

Implement rate limiting in Redis using an atomic GCRA Lua script (`RedisRateLimiter`). No in-memory fallback.

## Consequences

- `RateLimitService` is a shared port; policies attach in later phases.
- Prometheus records hits via bounded `policy` labels.
- Retry-after is computed from Redis time, not local clocks.
