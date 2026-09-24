# ADR-026: Phase 13 Worker Observability HTTP Surface

**Status:** Accepted  
**Date:** 2026-09-24

## Context

Nexora runs two Node.js processes — **API** (`src/app/main.js`) and **Worker** (`src/workers/main.js`) — that share `createInfrastructure()` and the same Prometheus metrics port (`PrometheusMetrics` / `noopMetricsRecorder`).

The API exposes operational HTTP endpoints via Fastify:

| Endpoint | Purpose |
| -------- | ------- |
| `GET /health/live` | Liveness |
| `GET /health/ready` | Readiness (PostgreSQL, Redis, queue, storage) |
| `GET /internal/metrics` | Prometheus text exposition (when `METRICS_ENABLED=true`) |

Authentication is bypassed for `/health/*` and `/internal/metrics` on the API ([`authentication.plugin.js`](../../src/app/http/plugins/authentication.plugin.js)). OpenTelemetry HTTP instrumentation ignores probe and scrape paths ([`tracing.js`](../../src/infrastructure/observability/tracing.js)).

The worker process **already records** worker-relevant metrics into the same in-process registry:

- `queue_jobs_total`, `queue_job_duration_seconds` — BullMQ handlers ([`bullmq-worker-runtime.js`](../../src/infrastructure/queue/bullmq-worker-runtime.js))
- `webhook_delivery_*` — HTTP delivery worker ([`webhook-delivery-service.js`](../../src/modules/webhooks/application/webhook-delivery-service.js))
- `nexora_retention_cleanup_*` — retention sweeps ([`retention-cleanup-service.js`](../../src/infrastructure/postgres/retention-cleanup-service.js))
- `db_*`, `redis_*`, Node.js default metrics — shared infrastructure adapters

Until Phase 13, those series are **not scrapeable** from the worker: there is no HTTP listener on the worker process. Operators infer worker health from logs, queue depth, and API-side signals. [ADR-020](ADR-020-phase-7-channel-inbound-integration.md) deferred a **Worker metrics HTTP endpoint** as operational follow-up; Phases 10–12 closed the webhook retention and Retry-After deferrals.

## Problem

1. **Observability gap** — Prometheus local config scrapes only the API (`host.docker.internal:3000`, `/internal/metrics`). Worker job failure, webhook delivery, and retention metrics exist in-process but are invisible to standard scrape workflows.
2. **Deployment gap** — `docs/operations/README.md` documents health probes for the API only. Container orchestrators cannot use HTTP probes against the worker without a defined contract.
3. **Identity gap** — API and worker currently share `OTEL_SERVICE_NAME` (default `nexora-backend`) and the same Prometheus `service` label when both use one `PrometheusMetrics` instance per process, which complicates dashboards when both processes run.

Phase 13 defines the contract; implementation follows in a separate change set.

---

## Decision

Add a **minimal Fastify HTTP server** to the worker process that exposes the same **path conventions** as the API for health and metrics, on a **separate bind port**, gated by configuration, with **worker-appropriate readiness probes** and **no public product API surface**.

---

## 1. Purpose

Workers must be operable independently of the API:

- Confirm the process is alive (liveness) for restart policy.
- Confirm the worker can reach dependencies required to **process jobs** (readiness) before receiving traffic in rolling deploys.
- Scrape Prometheus metrics that reflect queue processing, webhook delivery, retention, and shared infrastructure usage **from the worker process** where those handlers run.

This does not replace queue monitoring (Redis/BullMQ depth); it exposes the **application metrics and probes** already implied by the architecture.

---

## 2. Scope

### In scope (Phase 13)

| Capability | Endpoint | Notes |
| ---------- | -------- | ----- |
| Liveness | `GET /health/live` | Process alive; not dependency-sensitive |
| Readiness | `GET /health/ready` | Worker-specific dependency set (below) |
| Metrics | `GET /internal/metrics` | Same renderer as API (`MetricsRecorder.render()`), when `METRICS_ENABLED=true` |
| Configuration | Environment variables | Host, port, enable flag |
| Shutdown integration | `gracefulShutdown` | Readiness fails; HTTP server closes before workers drain |
| Documentation | Ops / overview / Prometheus example | Scrape target for worker |
| OpenTelemetry | Distinct worker `service.name` | See §7 |

### Out of scope (Phase 13)

- New metric types beyond what the existing registry already supports (no invented BullMQ queue-depth gauges unless a bounded, existing health check already exposes queue connectivity).
- Authenticating scrape traffic with API keys (network isolation instead).
- Exposing worker HTTP on the API port or routing worker probes through the API load balancer.
- Kubernetes-specific CRDs, ServiceMonitor resources, or Helm charts.
- Changing BullMQ job semantics, webhook delivery, or API routes.
- `/metrics` alias (API uses `/internal/metrics` only; worker matches API).
- Root `GET /health` — use `/health/live` and `/health/ready` for parity with the API.

---

## 3. Binding and configuration

New environment variables (to be added to `src/app/config/schema.js` in implementation):

| Variable | Purpose | Development default | Production behaviour |
| -------- | ------- | ------------------- | -------------------- |
| `WORKER_OBSERVABILITY_HTTP_ENABLED` | Start worker Fastify listener | `true` | `true` unless explicitly disabled (e.g. constrained local test) |
| `WORKER_OBSERVABILITY_HOST` | Bind address | `127.0.0.1` | **`127.0.0.1` unless overridden** — set to `0.0.0.0` only when in-cluster probes or scrapes reach the pod/container network interface. **Never** front this port with a public load balancer. |
| `WORKER_OBSERVABILITY_PORT` | TCP port | `3001` | Operator-chosen; must not collide with `SERVER_PORT` on co-located dev machines |

Rules:

- Worker observability HTTP is **independent** of `SERVER_HOST` / `SERVER_PORT` (API-only).
- When `WORKER_OBSERVABILITY_HTTP_ENABLED=false`, the worker behaves as today (no listener); metrics remain in-process only.
- When `METRICS_ENABLED=false`, health endpoints still work; **`GET /internal/metrics` returns `404`** (or is not registered — implementation must pick one behaviour and test it; preferred: route absent → 404, matching “metrics disabled”).
- `SERVER_SHUTDOWN_TIMEOUT_MS` applies to worker shutdown ordering (same as today).

---

## 4. Health semantics

Reuse [`ReadinessService`](../../src/app/observability/readiness.js) pattern: `markNotReady()` on shutdown start; `evaluate()` for readiness.

### Liveness — `GET /health/live`

**Question:** Is the worker process alive?

| Condition | HTTP | Body |
| --------- | ---- | ---- |
| Process running, not in shutdown | `200` | `{ "status": "ok" }` |
| Shutdown started (`markNotReady` / shutting down flag) | `503` | `{ "status": "shutting_down" }` |

Liveness **must not** fail because PostgreSQL, Redis, or the queue broker is temporarily unavailable. Orchestrators may restart the pod on liveness failure; dependency blips should surface on **readiness**, not liveness.

### Readiness — `GET /health/ready`

**Question:** Is the worker ready to process jobs?

| Check name | Included | Rationale |
| ---------- | -------- | --------- |
| `postgres` | Yes | All handlers persist via PostgreSQL (inbox, outbox reads, webhook deliveries, retention). |
| `redis` | Yes | Cache, locks, rate limiter backing store; queue uses Redis (same or `QUEUE_REDIS_URL`). |
| `queue` | Yes | `BullMqJobQueue.healthCheck()` — verifies queue Redis connectivity used by BullMQ. |
| `storage` | **No** | Worker handlers in Phase 13 do not require object storage for job processing; API readiness includes storage for upload/readiness parity on the API surface only. |
| `workers_registered` | Yes (implementation) | At least one BullMQ `Worker` instance registered on `BullMqWorkerRuntime` after handler registration. Fails fast if worker startup did not register consumers. |

| Condition | HTTP | Body shape |
| --------- | ---- | ---------- |
| All checks pass, accepting traffic | `200` | `{ "status": "ready", "checks": { "postgres": "ok", ... } }` |
| Any check fails or shutting down | `503` | `{ "status": "not_ready", "checks": { ... } }` |

Readiness failure does **not** stop the BullMQ workers already running (implementation may already be consuming); it signals orchestrators **not to treat the replica as ready** during deploy or dependency outage. This matches API semantics.

---

## 5. Metrics

### Endpoint

- **Path:** `GET /internal/metrics` (same as API).
- **Format:** Prometheus text exposition (`Content-Type` from `metrics.contentType`).
- **Enabled when:** `METRICS_ENABLED=true` and worker observability HTTP is enabled.

### Reused series (no new names required for Phase 13)

Already emitted in the worker process today:

| Metric | Labels (bounded) | Source |
| ------ | ---------------- | ------ |
| `queue_jobs_total` | `queue`, `job_name`, `state` | Job handler outcomes (`completed`, `failed`, …) |
| `queue_job_duration_seconds` | `queue`, `job_name` | Handler duration |
| `webhook_delivery_attempts_total` | `outcome` | Webhook delivery |
| `webhook_delivery_duration_seconds` | `outcome` | Successful / timed delivery |
| `nexora_retention_cleanup_*` | `resource`, `outcome` | Retention scheduler |
| `db_query_duration_seconds` | `operation`, `result` | PostgreSQL adapter |
| `db_pool_connections` | `state` | Pool snapshot (implementation should run periodic `reportPoolMetrics` on worker, mirroring API) |
| `redis_operations_total` / `redis_operation_duration_seconds` | `operation`, `result` | Redis adapter |
| Node default metrics | `service` | `collectDefaultMetrics` |

### Explicitly not required in Phase 13

- Per-tenant, per-order, or per-job-id labels (forbidden by existing [`prometheus-metrics.js`](../../src/infrastructure/observability/prometheus-metrics.js) policy).
- Duplicate HTTP request metrics for high-volume scrape paths unless bounded route templates are used; prefer **excluding** `/health/*` and `/internal/metrics` from HTTP request counters on the worker observability server (same rationale as trace filtering on the API).

### Queue “health”

Queue **connectivity** is a readiness check, not a separate metrics endpoint. BullMQ backlog depth is **not** part of Phase 13 unless already available via existing `queue.healthCheck()` (connectivity-only today).

---

## 6. Security

| Topic | Decision |
| ----- | -------- |
| Exposure | **Internal operational** surface only — not part of `/api/v1` or `/api/v2`. |
| Bind address | Default `127.0.0.1`; production in-cluster use requires explicit `WORKER_OBSERVABILITY_HOST=0.0.0.0` with **network policy** restricting source IPs to observability namespace / host agent. |
| Authentication | **None** on health and metrics routes (consistent with API). Do not require API keys for Prometheus scrape. |
| Load balancer | **Must not** publish worker observability ports on the same public LB as customer API traffic. |
| Helmet / CORS | Minimal hardening acceptable; no CORS needed (scrape/probe agents only). |

---

## 7. Observability

| Topic | Decision |
| ----- | -------- |
| Prometheus `service` label | Worker process passes **`{OTEL_SERVICE_NAME}-worker`** (or dedicated `WORKER_OTEL_SERVICE_NAME` defaulting to that suffix) into `PrometheusMetrics` so API and worker scrape targets are distinguishable. |
| OpenTelemetry `service.name` | Same rule: **`${OTEL_SERVICE_NAME}-worker`** unless `WORKER_OTEL_SERVICE_NAME` is set. |
| HTTP probe tracing | Incoming requests to `/health/*` and `/internal/metrics` on the worker **must** be ignored by HTTP auto-instrumentation (same path rules as API). |
| Logging | Use existing Pino logger; log worker observability server start at `info` with `{ host, port }`; probe requests at `debug` or silent (match API logging plugin behaviour — avoid log noise from 10s scrapes). |
| Request correlation | Probes may send `X-Request-Id`; worker observability server should accept but not require it. |

---

## 8. Deployment

| Consumer | Recommended probe / scrape |
| -------- | --------------------------- |
| Docker Compose (local) | Optional: `curl http://127.0.0.1:3001/health/ready` when worker runs on host; Prometheus observability profile adds a second scrape job (see implementation update to `infrastructure/observability/prometheus.yml`). |
| Kubernetes / generic orchestrator | **Liveness:** `GET /health/live` on `WORKER_OBSERVABILITY_PORT`. **Readiness:** `GET /health/ready`. **Metrics:** Prometheus scrapes pod IP:`WORKER_OBSERVABILITY_PORT` `/internal/metrics` (not through public Ingress). |
| Process layout | API and worker remain **separate processes**; separate ports (`SERVER_PORT` vs `WORKER_OBSERVABILITY_PORT`). |

No Kubernetes-specific resources are required by this ADR.

---

## 9. Failure behaviour

| Scenario | Liveness | Readiness | Metrics | Job processing |
| -------- | -------- | --------- | ------- | ---------------- |
| Graceful shutdown (SIGTERM) | `503` shutting_down | `503` not_ready | Listener closed after drain sequence | Stops accepting new jobs; drains in-flight until timeout |
| PostgreSQL unavailable | `200` ok | `503` postgres failed | May still render stale registry | Handlers fail; BullMQ retries |
| Redis unavailable | `200` ok | `503` redis failed | May still render | Handlers / locks fail |
| Queue Redis unreachable | `200` ok | `503` queue failed | May still render | Workers error |
| `METRICS_ENABLED=false` | Health unchanged | Health unchanged | `404` (metrics route disabled) | Unchanged |
| Metrics `render()` throws | `200` / `503` per readiness | Same | `500` empty or minimal error body; log error | Unchanged |
| Observability HTTP disabled | N/A (connection refused) | N/A | N/A | Unchanged |

Shutdown order (extends existing [`shutdown.js`](../../src/app/bootstrap/shutdown.js) for worker):

1. `readiness.markNotReady()`
2. Close worker observability HTTP server (stop probes returning success)
3. `retentionCleanupScheduler.stop()`
4. `workerRuntime.close()` (drain active jobs)
5. `queue.close()`, `redis.close()`, `database.close()`, tracing flush

---

## 10. Backward compatibility

- API routes, ports, and metrics paths **unchanged**.
- Worker job registration, BullMQ retry semantics, and webhook Phase 12 behaviour **unchanged**.
- Default worker behaviour when `WORKER_OBSERVABILITY_HTTP_ENABLED=false` matches pre–Phase 13 (no listener).
- Existing Prometheus metric names and label sets **unchanged**; only scrape target and `service` label on worker differ.

---

## Implementation notes (non-normative)

- Prefer a small shared module for health + metrics route registration used by API and worker to avoid drift (e.g. extract from [`health.routes.js`](../../src/app/http/routes/health.routes.js) / [`metrics.routes.js`](../../src/app/http/routes/metrics.routes.js)).
- Worker entrypoint: start observability HTTP **after** `registerWorkerHandlers` so `workers_registered` readiness passes.
- Integration tests: inject Fastify like [`http.test.js`](../../tests/integration/http.test.js) for worker observability app factory.

---

## Acceptance criteria

1. Worker process exposes `GET /health/live` on `WORKER_OBSERVABILITY_HOST`:`WORKER_OBSERVABILITY_PORT` when `WORKER_OBSERVABILITY_HTTP_ENABLED=true`.
2. Worker exposes `GET /health/ready` with checks `postgres`, `redis`, `queue`, and `workers_registered`; **does not** require storage.
3. Worker exposes `GET /internal/metrics` when `METRICS_ENABLED=true`, returning the same Prometheus format as the API.
4. Worker metrics scrape includes `queue_jobs_total`, webhook delivery, and retention series produced in that process.
5. Prometheus default labels distinguish worker from API (`service` / OTEL name suffix `-worker`).
6. Liveness does not fail on transient PostgreSQL/Redis/queue outages; readiness does.
7. On SIGTERM, readiness and liveness report not ready / shutting down before BullMQ workers close.
8. Default bind `127.0.0.1:3001` prevents accidental wide exposure in local dev.
9. No authentication on worker observability routes; documentation states LB must not expose the port publicly.
10. API metrics, health, and product routes remain unchanged.
11. Configuration is entirely environment-driven via `schema.js`.
12. OpenTelemetry HTTP instrumentation ignores worker probe/scrape paths.
13. `git`-documented Prometheus example includes optional worker scrape target.
14. Existing test suite passes; new tests cover worker health/metrics happy paths and shutdown readiness.

---

## Consequences

**Positive**

- Closes ADR-020 “Worker metrics HTTP endpoint” deferral with an explicit, reviewable contract.
- Enables standard Prometheus and orchestrator probes for horizontally scaled workers.

**Negative**

- Second HTTP server per worker replica (minimal overhead).
- Operators must configure bind address and scrape targets deliberately.

---

## Related

- [ADR-020](ADR-020-phase-7-channel-inbound-integration.md) — deferred ops table
- [ADR-025](ADR-025-phase-12-webhook-retry-after-scheduling.md)
- [overview.md](../architecture/overview.md)
- [requirements.md](../architecture/requirements.md)
- [operations README](../operations/README.md)
- [workers/README.md](../../workers/README.md)
