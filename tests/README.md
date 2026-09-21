# Tests

Nexora uses **Vitest** with two projects defined in `vitest.config.ts`: `unit` and `integration`.

## Commands

| Command                    | Scope                                        |
| -------------------------- | -------------------------------------------- |
| `npm run test`             | Unit tests only                              |
| `npm run test:unit`        | Same as above                                |
| `npm run test:integration` | Integration tests (requires Docker services) |
| `npm run test:all`         | Both projects                                |
| `npm run test:watch`       | Unit tests in watch mode                     |
| `npm run verify`           | typecheck + lint + arch:check + unit tests   |

## Layout

```
tests/
├── unit/                 Pure logic, no external services
│   ├── config.test.ts
│   ├── errors.test.ts
│   ├── idempotency-fingerprint.test.ts
│   ├── logging-redaction.test.ts
│   ├── pagination.test.ts
│   ├── postgres-errors.test.ts
│   ├── request-context.test.ts
│   └── validation.test.ts
└── integration/          Real PostgreSQL, Redis, MinIO
    ├── setup.ts          Global setup hooks
    ├── helpers.ts        Shared test utilities
    ├── http.test.ts
    ├── postgres.test.ts
    ├── redis.test.ts
    ├── storage.test.ts
    ├── idempotency.test.ts
    └── outbox-inbox.test.ts
```

## Unit tests

- No Docker required
- Fast — run on every `verify`
- Test `shared/`, `app/config`, error mapping, pure functions
- Mock ports — never connect to real databases

## Integration tests

- Require `docker compose up -d`
- Use real PostgreSQL, Redis, and MinIO with test configuration from `tests/integration/setup.ts`
- Exercise adapter implementations end-to-end
- Slower — run before merge and in CI with service containers

### Running integration tests locally

```bash
docker compose up -d
npm run test:integration
```

If services are unavailable, integration tests fail fast with connection errors.

## Writing new tests

### Unit test

Place alongside concern in `tests/unit/<name>.test.ts`. Import from `src/` using `.js` extension (ESM).

### Integration test

1. Add `tests/integration/<feature>.test.ts`
2. Use helpers from `helpers.ts` for database cleanup and HTTP server injection
3. Clean up data in `afterEach` to keep tests isolated

## CI expectations

Minimum merge gate: `npm run verify` (unit + static analysis).

Full gate before release: `npm run test:all` with Docker services.

## Related

- [vitest.config.ts](../vitest.config.ts)
- [docs/architecture/requirements.md](../docs/architecture/requirements.md) — NFR-4
