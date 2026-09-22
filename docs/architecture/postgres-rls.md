# PostgreSQL Row-Level Security

**Status:** Phase 5.1 hardened  
**Last updated:** 2026-09-21

## Intended model

```text
HTTP authentication
        ↓
tenant context (JWT / API key)
        ↓
application authorization
        ↓
PostgresDatabase.execute({ tenantId }) → set_config('app.tenant_id', …, true)
        ↓
RLS policies: tenant_id = app.current_tenant_id()
```

Application checks and RLS are **complementary**. Neither replaces the other.

## Roles

| Role | Purpose | RLS |
| ---- | ------- | --- |
| `nexora` (Docker default owner) | Migrations, schema ownership | **Bypasses RLS** (superuser) |
| `nexora_app` | Runtime application connections | **Subject to RLS** (non-superuser, not owner) |

Migration `0030_rls_hardening.sql`:

- Creates `nexora_app` (LOGIN, NOSUPERUSER, NOBYPASSRLS).
- Applies `FORCE ROW LEVEL SECURITY` on every table that already has RLS enabled.
- Grants DML on `public` tables and `EXECUTE` on `app` functions to `nexora_app`.

## Configuration

```env
DATABASE_URL=postgresql://nexora_app:nexora@localhost:5433/nexora
DATABASE_MIGRATION_URL=postgresql://nexora:nexora@localhost:5433/nexora
```

When `DATABASE_MIGRATION_URL` is omitted, migrations run on the same connection as runtime (backward compatible for local experiments — **not recommended for production**).

## Tenant context

`PostgresDatabase.execute()` sets `app.tenant_id` transaction-locally via `set_config($1, $2, true)`.

`app.current_tenant_id()` returns `NULL` when unset. Policies comparing `tenant_id = app.current_tenant_id()` **deny all rows** when context is missing — no accidental global reads.

## Tables without RLS

Global catalog tables (`permissions`, `tenants`, `users`, …) and infrastructure tables (`idempotency_records`, `outbox_events`) rely on application-level scoping. This is intentional; tenant-scoped commerce tables use RLS.

## Verification

Integration test `tests/integration/postgres-rls.test.js` uses a dedicated `nexora_app` pool to assert:

- Cross-tenant reads return zero rows under RLS.
- Missing tenant context returns zero rows.
- Same-tenant reads succeed.

Tests using the default application pool validate end-to-end tenant isolation via HTTP (application + RLS when runtime role is `nexora_app`).

## Limitations

- **Superuser runtime bypasses all RLS.** Production and CI should use `nexora_app` for `DATABASE_URL`.
- **Superusers always bypass RLS** even with `FORCE ROW LEVEL SECURITY`. Only non-superuser runtime roles gain DB-level enforcement.
- **Password in migration** matches local Docker defaults; production must rotate `nexora_app` credentials via deployment tooling.
