# Phase 1 Requirements

Functional and non-functional requirements for the Nexora Backend **foundation phase**. Business-domain features are explicitly out of scope.

## Functional requirements

### FR-1 HTTP API server

- Expose a Fastify-based HTTP server with structured request/response validation (Zod).
- Serve native API routes under `/api/v1`.
- Provide foundation verification endpoints (`/api/v1/foundation/ping`, `/api/v1/foundation/echo`).
- Expose liveness (`/health/live`) and readiness (`/health/ready`) probes.
- Optionally serve OpenAPI document and Scalar reference at `/docs`.

### FR-2 Configuration

- Load and validate all environment variables through a single Zod schema at startup.
- Reject unknown or malformed configuration early (fail fast).

### FR-3 PostgreSQL persistence

- Connect via connection pool with configurable limits and timeouts.
- Run versioned SQL migrations on startup.
- Provide tenant context helper (`app.current_tenant_id()`) for future RLS policies.
- Store outbox events, inbox deduplication records, and idempotency records.

### FR-4 Transactional outbox

- Record integration events in the same database transaction as business writes (port ready; no domain writers yet).
- Publish unpublished events to BullMQ via a background publisher process.
- Support at-least-once delivery with claim/retry/dead-letter semantics.

### FR-5 Inbox deduplication

- Allow consumers to process each `(consumer_name, event_id)` pair exactly once.
- Track processing status and support safe redelivery after at-least-once publish.

### FR-6 Idempotency

- Persist idempotency records in PostgreSQL (not Redis) so replays after client timeouts return the original response.
- Support TTL-based expiry of records.

### FR-7 Redis infrastructure

- Cache abstraction with namespaced keys.
- Distributed lock abstraction.
- Rate limiter abstraction.
- Separate queue Redis URL support for production isolation.

### FR-8 Job queue

- Enqueue and process jobs via BullMQ.
- Run a dedicated worker process (`src/workers/main.ts`).
- Declare queue and job names as a closed set of constants.

### FR-9 Object storage

- S3-compatible storage provider (MinIO locally, managed S3 in production).
- Support path-style addressing for MinIO.

### FR-10 Observability foundations

- Structured JSON logging (Pino) with field redaction.
- Prometheus metrics endpoint (when enabled).
- Optional OpenTelemetry tracing with OTLP export.
- Request ID propagation through request context.

### FR-11 Error handling

- Map internal errors to a consistent HTTP error envelope.
- Never leak stack traces or internal details in production responses.

## Non-functional requirements

### NFR-1 Architecture boundaries

- Enforce module layering via `dependency-cruiser` (`npm run arch:check`).
- Domain code must not import infrastructure packages or layers.

### NFR-2 Node runtime

- Target Node.js 24+ (`engines.node` in `package.json`).

### NFR-3 Local developer experience

- Single `docker compose up -d` starts PostgreSQL, Redis, and MinIO.
- Hot reload for API and worker via `tsx watch`.
- `npm run verify` as the default pre-commit quality gate.

### NFR-4 Testability

- Unit tests run without external services.
- Integration tests exercise real PostgreSQL, Redis, and MinIO when available.

### NFR-5 Security baseline

- Helmet HTTP headers.
- Configurable CORS (disabled by default — empty origins).
- No secrets in source control; `.env.example` documents variables only.

### NFR-6 Graceful shutdown

- API and worker honour `SERVER_SHUTDOWN_TIMEOUT_MS` on SIGTERM/SIGINT.
- Drain in-flight HTTP requests and queue workers before exit.

## Out of scope (Phase 1)

- Business modules (orders, products, inventory, channels, …)
- Authentication and authorization
- ChannelEngine `/api/v2` compatibility routes
- Webhook delivery to external systems
- Full audit log UI or retention automation
- Production Kubernetes manifests
- Separate read replicas or sharding

## Acceptance criteria

Phase 1 is complete when:

1. `npm run verify` passes in CI.
2. Integration tests pass against Docker-backed services.
3. API starts, migrations apply, health checks report ready with dependencies up.
4. Worker consumes integration-event jobs and inbox deduplication prevents double processing.
5. Architecture boundary rules pass with zero errors.
6. Documentation set (this folder + ADRs) is complete and accurate.
