# ADR-008: Multi-Tenancy

## Status

Accepted — foundation implemented in Phase 1.

## Context

Tenants must be isolated defensively at the database layer as well as in application logic.

## Decision

Use PostgreSQL row-level security with a transaction-local tenant setting:

```sql
SELECT set_config('app.tenant_id', $1, true);
```

Tenant context is established from authenticated request/application context, never from arbitrary client-supplied body fields.

## Consequences

- `PostgresDatabase.execute()` accepts optional `tenantId`.
- `app.current_tenant_id()` helper is migration `0001`.
- Business RLS policies are added with each tenant-scoped module in later phases.
