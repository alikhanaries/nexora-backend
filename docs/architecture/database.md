# Database Architecture

PostgreSQL is the **single source of truth** for durable state. Redis holds ephemeral data only; it is never authoritative for business facts, idempotency, or event deduplication.

## Connection and access pattern

- **Driver:** `pg` (node-postgres) with a connection pool — see [ADR-011](../decisions/ADR-011-database-access.md).
- **Queries:** Raw SQL in repository classes under `src/infrastructure/postgres/`.
- **No ORM** in Phase 1 — keeps RLS policy authoring straightforward and avoids hidden query patterns.

Access flows through `PostgresDatabase`, which provides:

- Pooled connections with configurable min/max and timeouts
- Transaction helper for atomic multi-statement work
- Automatic migration on startup

## Schema organisation

Phase 1 migrations (applied in order):

| Migration                                | Purpose                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `0001_app_schema_and_tenant_context.sql` | `app` schema, `app.current_tenant_id()` for RLS |
| `0002_outbox_events.sql`                 | Transactional outbox table                      |
| `0003_inbox_messages.sql`                | Consumer deduplication ledger                   |
| `0004_idempotency_records.sql`           | HTTP mutation replay ledger                     |

Business domain tables will live in the `app` schema (or module-specific schemas if volume warrants) in Phase 2+.

## Multi-tenancy and RLS

The tenant context function reads a transaction-local setting:

```sql
SELECT app.current_tenant_id();  -- NULL when unset
```

The application will call `set_config('app.tenant_id', '<uuid>', true)` at the start of each request transaction once authentication exists. RLS policies on domain tables will compare `tenant_id` columns against `app.current_tenant_id()` and **deny** when the GUC is NULL.

Phase 1 creates the helper only; domain RLS policies are deferred.

## Migrations

- SQL files in `src/infrastructure/postgres/migrations/` with numeric prefixes.
- Tracked in a `schema_migrations` table by `Migrator`.
- Run via `npm run migrate` or automatically on API startup.

**Rules:**

- Migrations are forward-only in production (no `down` scripts).
- Destructive changes require a multi-step expand/contract plan documented in an ADR.
- Index changes on large tables should be `CONCURRENTLY` in production runbooks.

## Transactional patterns

### Outbox write

Business mutation and outbox insert share one transaction:

```
BEGIN
  -- business INSERT/UPDATE
  INSERT INTO outbox_events (...)
COMMIT
```

If the transaction rolls back, no event is published.

### Idempotency claim

Idempotency uses a unique index on `(tenant, principal, route, key)`. Concurrent replays race on insert; the loser reads the winner's stored response.

## Indexing strategy

Each foundation table includes indexes aligned to its hot path:

- **Outbox:** partial index on unpublished, non-dead-lettered rows
- **Inbox:** primary key `(consumer_name, event_id)` is the dedup mechanism
- **Idempotency:** unique composite key + expiry sweep index

Domain tables will follow the same principle: index the query path, not every column.

## Local development

```bash
docker compose up -d postgres
npm run migrate
npm run migrate:status
```

Default connection: `postgresql://nexora:nexora@localhost:5432/nexora` (see `.env.example`).

## Operations

- Statement and query timeouts are configured via environment (default 15 s).
- Pool size defaults to 10; tune per deployment based on CPU and `max_connections`.
- See [docs/database/README.md](../database/README.md) for backup and restore guidance (placeholder for Phase 1).

## Related ADRs

- [ADR-003 PostgreSQL as source of truth](../decisions/ADR-003-postgresql-source-of-truth.md)
- [ADR-005 Transactional outbox](../decisions/ADR-005-transactional-outbox.md)
- [ADR-007 Idempotency in PostgreSQL](../decisions/ADR-007-idempotency-postgresql.md)
- [ADR-011 Database access with pg](../decisions/ADR-011-database-access.md)
