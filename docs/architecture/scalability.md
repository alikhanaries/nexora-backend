# Scalability

Phase 1 optimises for **correctness and clear boundaries** over maximum throughput. The design supports horizontal scaling when load requires it.

## Scaling dimensions

### API process

- **Stateless** — session state is not held in memory.
- Scale by running multiple API instances behind a load balancer.
- Readiness probe (`/health/ready`) gates traffic until PostgreSQL, Redis, queue, and storage are reachable.

### Worker process

- Scale independently of API instances.
- `QUEUE_WORKER_CONCURRENCY` controls parallel jobs per worker pod.
- Add worker replicas for higher job throughput.

### PostgreSQL

- Single primary in Phase 1.
- Connection pool per API/worker instance (`DATABASE_POOL_MAX`); total connections = instances × pool max — stay under PostgreSQL `max_connections`.
- Read replicas and connection poolers (PgBouncer) are future options for read-heavy workloads.

### Redis

- Single instance locally; production should use managed Redis with persistence.
- **Separate Redis for BullMQ** (`QUEUE_REDIS_URL`) recommended in production so cache eviction never affects queue integrity.
- BullMQ requires `noeviction` — never share a cache-evicting Redis with the queue.

### Object storage

- S3 and compatible stores scale horizontally by design.
- Large uploads should use pre-signed URLs (to be implemented with domain modules).

## Bottleneck awareness

| Component            | Likely bottleneck          | Mitigation                                                             |
| -------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Outbox publisher     | Poll interval + batch size | Tune `OUTBOX_*` env vars; add publisher instances with claim semantics |
| PostgreSQL writes    | Single primary             | Batch writes, avoid chatty transactions, index discipline              |
| Integration handlers | Worker concurrency         | Scale workers; keep handlers idempotent and fast                       |
| Idempotency table    | Unique index contention    | Short TTL, partition by tenant later if needed                         |

## Outbox at scale

The outbox uses row claiming (`claimed_at`) so multiple publisher instances can run safely. Unpublished rows are indexed partially — backlog size drives poll cost, not total table size.

Retention sweeps for published outbox events, processed inbox rows, and expired idempotency records run on the worker process (Phase 6.6; see [events.md](events.md)).

## Caching strategy

`RedisCache` is available for read-heavy, eventually-consistent data. Cache-aside pattern:

1. Read cache
2. On miss, read PostgreSQL
3. Populate cache with TTL

Never cache authoritative writes without invalidation strategy.

## Rate limiting

`RedisRateLimiter` provides token-bucket style limits. Apply at the presentation layer once auth identifies the principal.

## Observability for scaling decisions

- Prometheus metrics: request latency, pool stats, queue depth (when instrumented).
- Structured logs with request ID for tracing slow paths.
- Enable OpenTelemetry (`TRACING_ENABLED=true`) when diagnosing cross-service latency.

## What we are not doing in Phase 1

- Sharding PostgreSQL by tenant
- Event sourcing as primary storage
- CQRS read models
- Kubernetes HPA manifests

Extract services from the modular monolith only when a module's load or release cadence justifies the operational cost.
