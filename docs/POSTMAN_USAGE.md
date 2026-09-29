# Nexora Postman collection — usage

## Files

| File | Purpose |
| ---- | ------- |
| `postman/Nexora_Backend_API.postman_collection.json` | Full API collection (v2.1) |
| `postman/Nexora_Local.postman_environment.json` | Local environment template |
| `docs/POSTMAN_API_INVENTORY.md` | Verified route inventory for Postman |
| `docs/POSTMAN_COVERAGE_REPORT.md` | Route ID ↔ request mapping |

## Import into Postman

1. Open Postman → **Import** → select `postman/Nexora_Backend_API.postman_collection.json`.
2. Import `postman/Nexora_Local.postman_environment.json`.
3. Select the **Nexora Local** environment in the top-right dropdown.

## Configure local API

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `baseUrl` | `http://localhost:3000` | Main Fastify API (`SERVER_PORT`) |
| `workerBaseUrl` | `http://127.0.0.1:3001` | Worker observability HTTP (`WORKER_OBSERVABILITY_PORT`) |
| `tenantSlug`, `email`, `password` | placeholders | Used by **Login** request body |
| `accessToken`, `refreshToken` | empty | Set automatically after successful login |
| `apiKey` | empty | Optional `x-api-key` (override auth on a request if needed) |
| `ceApiKey` | empty | StockConnect CE: header `X-CE-KEY` or query `apiKey` |
| `ingressToken` | empty | Marketplace webhook ingress path segment |

Start the API: `npm run dev` (requires `.env` with database and Redis).

Enable docs locally: `DOCS_ENABLED=true` (default in development).

## Authenticate

1. Set `tenantSlug`, `email`, and `password` in the environment (use a dev tenant/user — never production credentials).
2. Run **Authentication → `[R-xxxx] Authenticate with tenant slug, email and password`** (`POST /api/v1/auth/login`).
3. The request **Tests** script stores `accessToken` and `refreshToken` in the environment and collection variables.
4. Protected requests inherit **Bearer** auth from the collection (`{{accessToken}}`).

Public routes (health, auth login/refresh/logout, tenant create, webhooks ingress, docs URLs) use **No Auth** at the request level.

## API keys and CE compatibility

- Most `/api/v1/*` routes accept **JWT Bearer** or **`x-api-key`** (see OpenAPI security schemes).
- `/api/v2/*` Merchant compatibility routes document both schemes in OpenAPI.
- `/api/v2/ce/*` routes accept Bearer, `x-api-key`, query `apiKey`/`apikey`, or header `X-CE-KEY` (see `authentication.plugin.js`).

## Safe testing

- Run **GET** and read-only requests freely against a local database.
- **POST/PUT/PATCH/DELETE** may change data — use a disposable dev tenant.
- Merchant v2 mutating routes may require **`Idempotency-Key`**; the collection adds an optional header where applicable.
- Do not run bulk delete, production cutover, or financial flows against shared or production environments.

## Authentication workflow (manual order)

1. `POST /api/v1/auth/login`
2. `GET /api/v1/auth/me`
3. `POST /api/v1/auth/refresh` (optional)
4. `POST /api/v1/auth/logout` (optional)

## Worker APIs

Worker routes live under folder **Worker Observability (separate listener)** and use `{{workerBaseUrl}}`.

Start the worker process separately (see `src/workers/main.js`). Observability HTTP is enabled when `WORKER_OBSERVABILITY_HTTP_ENABLED=true`.

## Regenerate collection and validate coverage

After backend route or schema changes:

```bash
node scripts/audit-route-inventory.mjs
node scripts/dump-openapi.mjs docs/.openapi-snapshot.json
node scripts/generate-postman-collection.mjs
node scripts/verify-postman-coverage.mjs
```

Optional (if already on `package.json` from Swagger audit): `npm run docs:route-inventory` and `npm run docs:openapi-coverage`.

## Known limitations

- **Authorization (RBAC)** permissions are enforced in handlers; Postman documents authentication, not every permission name.
- **Response examples** are derived from OpenAPI/Zod schemas, not from live API calls unless you add them manually after testing.
- **Scalar `/docs`** routes are not duplicated in Postman beyond OpenAPI JSON endpoints where listed in the inventory.
- Worker endpoints are **not** reachable via `baseUrl`; use `workerBaseUrl` only.
