# Database Guide

Practical guide for working with Nexora's PostgreSQL database.

## Connection

Default local URL (from `.env.example`):

```
postgresql://nexora:nexora@localhost:5432/nexora
```

Connect with any PostgreSQL client:

```bash
docker compose exec postgres psql -U nexora -d nexora
```

## Migrations

SQL migrations live in `src/infrastructure/postgres/migrations/`.

```bash
npm run migrate          # apply all pending
npm run migrate:status   # show applied versions
```

Naming: `NNNN_description.sql` — four-digit prefix, snake_case description.

### Writing a migration

1. Add the next numbered file.
2. Use idempotent DDL where safe (`IF NOT EXISTS`).
3. Comment **why** at the top of the file (see existing migrations).
4. Add indexes for query paths introduced by the migration.
5. Run integration tests: `npm run test:integration`.

### Production notes

- Apply migrations before deploying code that depends on them.
- Avoid long-running locks — use `CREATE INDEX CONCURRENTLY` for large tables in manual runbooks.
- No automatic rollback scripts — plan forward fixes.

## Phase 1 tables

| Table                 | Schema | Purpose                 |
| --------------------- | ------ | ----------------------- |
| `outbox_events`       | public | Transactional outbox    |
| `inbox_messages`      | public | Consumer deduplication  |
| `idempotency_records` | public | HTTP idempotency ledger |
| `schema_migrations`   | public | Migration tracking      |

Functions:

| Object                    | Purpose                   |
| ------------------------- | ------------------------- |
| `app.current_tenant_id()` | RLS tenant context helper |

## Tenant context (future)

Before domain queries in a request transaction:

```sql
SELECT set_config('app.tenant_id', '<uuid>', true);
```

RLS policies will reference `app.current_tenant_id()`. NULL means deny.

## Repository pattern

Database access is implemented in `src/infrastructure/postgres/`:

- One repository class per aggregate/table group
- Raw SQL with `$1, $2, ...` parameters
- Errors mapped via `postgres-errors.ts`

Business modules (Phase 2) may define module-specific repositories in `modules/*/infrastructure/` that use `PostgresDatabase` internally.

## Idempotency and outbox queries

Operators may inspect backlog:

```sql
-- Unpublished outbox events
SELECT id, event_type, attempt_count, last_error
FROM outbox_events
WHERE published_at IS NULL AND dead_lettered_at IS NULL
ORDER BY occurred_at
LIMIT 20;

-- Dead-lettered events needing attention
SELECT id, event_type, attempt_count, last_error
FROM outbox_events
WHERE dead_lettered_at IS NOT NULL
ORDER BY dead_lettered_at DESC
LIMIT 20;
```

## Backup and restore (outline)

Not automated in Phase 1. Recommended approach for production:

1. Managed PostgreSQL automated backups (PITR).
2. Pre-deploy snapshot before risky migrations.
3. Test restore procedure quarterly.

Local dev reset:

```bash
docker compose down -v
docker compose up -d
npm run migrate
```

## Performance tuning

Environment variables (see `.env.example`):

- `DATABASE_POOL_MAX` — connections per process
- `DATABASE_STATEMENT_TIMEOUT_MS` — kill long queries
- `DATABASE_QUERY_TIMEOUT_MS` — client-side query timeout

## Related

- [Database architecture](../architecture/database.md)
- [ADR-011 Database access](../decisions/ADR-011-database-access.md)
- [Events architecture](../architecture/events.md)
