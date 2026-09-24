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

## External compatibility API (`/api/v2`)

Optional Merchant-compatible surface — not required for native Nexora operation. Foundation probe only until endpoints are implemented. See [platform-independence.md](../architecture/platform-independence.md), [compatibility.md](../architecture/compatibility.md), and [ADR-018](../decisions/ADR-018-phase-5-merchant-compatible-scope.md).

## Marketplace connections (Phase 21–22)

Generic channel-scoped routes (never provider-specific paths). Credentials are accepted on create/patch but **never** returned in responses.

| Method   | Path                                                      |
| -------- | --------------------------------------------------------- |
| `POST`   | `/api/v1/channels/:channelId/marketplace-connection`      |
| `GET`    | `/api/v1/channels/:channelId/marketplace-connection`      |
| `PATCH`  | `/api/v1/channels/:channelId/marketplace-connection`      |
| `DELETE` | `/api/v1/channels/:channelId/marketplace-connection`      |
| `POST`   | `/api/v1/channels/:channelId/marketplace-connection/test` |

Shopify connections use `credentials.shopDomain`, `credentials.accessToken`, and `configuration.shopifyLocationId` (see marketplaces adapter README). Connection test exercises the registered Shopify adapter over Admin GraphQL.

Requires `channels.read` / `channels.update`. See [ADR-029](../decisions/ADR-029-marketplace-connector-framework.md).

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
