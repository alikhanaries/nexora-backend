# API Strategy

Nexora exposes two API surfaces over time. Phase 1 implements only the **native API** foundation.

## Versioning model

| Prefix    | Audience                                                   | Status                            |
| --------- | ---------------------------------------------------------- | --------------------------------- |
| `/api/v1` | Nexora native clients, internal services, new integrations | **Active** (foundation endpoints) |
| `/api/v2` | ChannelEngine-compatible clients (migration path)          | **Deferred**                      |

Version is in the URL path — not negotiable via headers alone. Breaking changes to `/api/v1` require a new major version (`/api/v2` native, not to be confused with ChannelEngine `/api/v2`).

See [ADR-010](../decisions/ADR-010-api-versioning.md).

## Native API (`/api/v1`)

### Principles

1. **Explicit schemas** — every route declares Zod request/response types; OpenAPI generated from the same schemas.
2. **Consistent envelope** — success responses use `{ success: true, data: T }`; errors use the standard error envelope (see `src/app/errors/error-envelope.ts`).
3. **Idempotent mutations** — mutating endpoints accept `Idempotency-Key` header (middleware to be wired with domain routes).
4. **Tenant context** — authenticated requests scope data by tenant (Phase 2).

### Phase 1 endpoints

| Method | Path                      | Purpose                            |
| ------ | ------------------------- | ---------------------------------- |
| GET    | `/api/v1/foundation/ping` | Liveness of native API stack       |
| POST   | `/api/v1/foundation/echo` | Validation and serialization check |

### Documentation

When `DOCS_ENABLED=true`:

- OpenAPI JSON: `/openapi.json`
- Scalar UI: `/docs`

## ChannelEngine compatibility (`/api/v2`)

A separate **facade module** (`src/modules/channelengine-compatibility/`) will translate ChannelEngine request/response contracts to native use cases.

Rules:

- Facade contains **no business logic** — mapping and HTTP status translation only.
- Facade must **not** access repositories directly (enforced by dependency-cruiser).
- Parity tracked in [channelengine-compatibility-matrix.md](channelengine-compatibility-matrix.md).

See [channelengine-compatibility.md](channelengine-compatibility.md).

## Operations endpoints (unversioned)

| Path            | Purpose                          |
| --------------- | -------------------------------- |
| `/health/live`  | Process alive                    |
| `/health/ready` | Dependencies healthy             |
| `/metrics`      | Prometheus scrape (when enabled) |

These are not part of the public product API and may change without a version bump.

## Error handling

All routes pass through the global error handler:

- `AppError` → mapped status code and error code
- Validation errors → 400 with field details
- Unknown errors → 500 with generic message (details logged server-side)

## Future: pagination, filtering, sorting

List endpoints will use cursor-based pagination for large collections. Constants and helpers live in `src/shared/pagination/`.

## Client guidance

- Target `/api/v1` for all new integrations.
- Use `/api/v2` only when migrating from ChannelEngine and parity is confirmed in the compatibility matrix.
- Always send `X-Request-Id` or accept the server-generated one for support correlation.
