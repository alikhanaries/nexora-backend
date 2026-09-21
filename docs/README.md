# Nexora Backend Documentation

Documentation for the Nexora commerce platform backend. Phase 1 covers foundation infrastructure only; business domain modules are planned for later phases.

## Start here

| Audience               | Document                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| New engineers          | [Architecture overview](architecture/overview.md)                                                          |
| Implementing a feature | [Module boundaries](architecture/module-boundaries.md) + [src/modules/README.md](../src/modules/README.md) |
| API design             | [API strategy](architecture/api-strategy.md)                                                               |
| Database work          | [Database architecture](architecture/database.md) + [database/README.md](database/README.md)               |
| Security review        | [Security architecture](architecture/security.md)                                                          |
| Operations / on-call   | [Operations guide](operations/README.md)                                                                   |

## Architecture

- [Architecture index](architecture/README.md)
- [Requirements](architecture/requirements.md)
- [Overview](architecture/overview.md)
- [Module boundaries](architecture/module-boundaries.md)
- [Database](architecture/database.md)
- [Events (outbox / inbox)](architecture/events.md)
- [Security](architecture/security.md)
- [Scalability](architecture/scalability.md)
- [Audit logging](architecture/audit-logging.md)
- [API strategy](architecture/api-strategy.md)
- [ChannelEngine compatibility](architecture/channelengine-compatibility.md)
- [Compatibility matrix (placeholder)](architecture/channelengine-compatibility-matrix.md)
- [Open questions](architecture/open-questions.md)
- [Phase 0 discovery summary](architecture/phase-0-discovery.md)

## Decisions (ADRs)

Architecture Decision Records capture significant choices and their rationale.

- [ADR index](decisions/README.md)
- ADR-001 through ADR-011 (see index for full list)

## Domain guides

- [API documentation](api/README.md)
- [Database guide](database/README.md)
- [Security guide](security/README.md)
- [Operations guide](operations/README.md)

## Source code guides

- [src/README.md](../src/README.md) — top-level source layout
- [src/modules/README.md](../src/modules/README.md) — business module conventions
- [tests/README.md](../tests/README.md) — test strategy
- [workers/README.md](../workers/README.md) — background worker process
- [infrastructure/README.md](../infrastructure/README.md) — Docker observability configs

## Phase status

| Phase                       | Status                      |
| --------------------------- | --------------------------- |
| Phase 0 — Discovery         | **Approved** (gate READY)   |
| Phase 1 — Foundation        | **In progress** (this repo) |
| Phase 2+ — Business modules | Not started                 |
