# API Documentation

Guide for Nexora's HTTP API surfaces.

## Active surface: Native API (`/api/v1`)

Phase 1 exposes foundation endpoints only. OpenAPI is generated from Zod schemas at runtime.

### Local access

With the API running (`npm run dev`) and `DOCS_ENABLED=true`:

| Resource     | URL                                |
| ------------ | ---------------------------------- |
| Scalar UI    | http://localhost:3000/docs         |
| OpenAPI JSON | http://localhost:3000/openapi.json |

### Foundation endpoints

**GET `/api/v1/foundation/ping`**

Returns `{ "success": true, "data": { "message": "pong" } }`.

**POST `/api/v1/foundation/echo`**

Request body: `{ "message": string }` (1–256 chars).

Returns the same body wrapped in the success envelope.

### Response envelope

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error (shape from error handler):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary"
  }
}
```

### Headers

| Header            | Direction        | Purpose                                       |
| ----------------- | ---------------- | --------------------------------------------- |
| `X-Request-Id`    | Request/Response | Correlation ID (server generates if absent)   |
| `Idempotency-Key` | Request          | Mutation replay protection (wired in Phase 2) |
| `Content-Type`    | Request          | Must be `application/json` for JSON bodies    |

## Deferred: ChannelEngine API (`/api/v2`)

Not registered in Phase 1. See [architecture/channelengine-compatibility.md](../architecture/channelengine-compatibility.md).

## Operations endpoints

Not part of the product API version contract:

| Endpoint            | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `GET /health/live`  | Process liveness                                 |
| `GET /health/ready` | Dependency readiness (503 if not ready)          |
| `GET /metrics`      | Prometheus metrics (when `METRICS_ENABLED=true`) |

## Adding new routes (Phase 2+)

1. Define Zod schemas for request and response.
2. Register route in the module's `presentation/` plugin.
3. Register plugin in `src/app/http/create-server.ts`.
4. Tag routes for OpenAPI grouping.
5. Add integration tests under `tests/integration/`.

## Related

- [API strategy](../architecture/api-strategy.md)
- [ADR-002 Fastify](../decisions/ADR-002-fastify-http-server.md)
- [ADR-010 API versioning](../decisions/ADR-010-api-versioning.md)
