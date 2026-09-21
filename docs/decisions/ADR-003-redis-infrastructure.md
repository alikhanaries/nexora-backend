# ADR-003: Redis Infrastructure Layer

## Status

Accepted — implemented in Phase 1.

## Context

Caching, coordination, rate limiting, and job queues need low-latency shared state without compromising PostgreSQL as the source of truth.

## Decision

Redis is used exclusively for infrastructure concerns: cache, distributed locks, rate limiting, and BullMQ backing. No business entity is authoritative in Redis.

## Consequences

- Single `RedisConnection` per process; keys namespaced via `RedisKeyBuilder`.
- Queue Redis should use `noeviction` in production (see `docker-compose.yml`).
- Locks coordinate work; correctness still relies on PostgreSQL constraints.
