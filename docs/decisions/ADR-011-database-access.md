# ADR-011: Database Access with node-postgres

**Status:** Accepted  
**Date:** 2025-09-01

## Context

The data layer needs PostgreSQL access that supports:

- Parameterised raw SQL (RLS-friendly — no ORM query builder hiding tenant filters)
- Explicit transaction control for outbox + business writes
- Lightweight dependency footprint
- Team familiarity and hiring pool

Alternatives considered:

| Option           | Pros                         | Cons                                                    |
| ---------------- | ---------------------------- | ------------------------------------------------------- |
| **Prisma**       | Type-safe client, migrations | RLS and raw SQL escape hatches; generated client weight |
| **Drizzle**      | Lighter ORM, SQL-like        | Still abstracts queries; less RLS visibility            |
| **Kysely**       | Type-safe query builder      | Builder learning curve; team preference for plain SQL   |
| **pg + raw SQL** | Full control, minimal magic  | Manual mapping; no auto-generated types                 |

## Decision

Use **node-postgres (`pg`)** with **raw SQL in repository classes**:

- `PostgresDatabase` wraps the connection pool and transaction helper
- Each table/aggregate has a repository under `src/infrastructure/postgres/` (or module `infrastructure/` later)
- Queries use `$1, $2, ...` parameter binding exclusively
- Row mapping is explicit TypeScript in repository methods

No ORM or query builder in Phase 1.

## Consequences

**Positive**

- **RLS-friendly** — policies apply transparently; no ORM multi-tenant plugin required
- Lightweight runtime — `pg` is a single well-understood dependency
- SQL in migration files and repositories matches exactly what runs in production
- Easy to optimise queries with `EXPLAIN` without fighting an abstraction

**Negative**

- No compile-time query checking — rely on integration tests and disciplined review
- Boilerplate for row mapping (acceptable trade-off for control)
- Schema changes require manual repository updates

## Implementation notes

- Pool config via environment (`DATABASE_POOL_*`, timeouts, SSL)
- Errors normalised in `postgres-errors.ts`
- OpenTelemetry instrumentation via `@opentelemetry/instrumentation-pg`

## Related

- [ADR-003](ADR-003-postgresql-source-of-truth.md)
- [database.md](../architecture/database.md)
- `src/infrastructure/postgres/postgres-database.ts`
