# Phase 0 Discovery — Summary Pointer

**Status:** Approved  
**Gate:** READY  
**Date:** Phase 0 complete; Phase 1 foundation work authorized

## Purpose

Phase 0 validated product direction, technical constraints, and the decision to build Nexora as a **modular monolith** with PostgreSQL as the system of record, Redis for ephemeral infrastructure, and a deferred ChannelEngine compatibility surface.

This document is a **summary pointer**. Detailed discovery artefacts (stakeholder interviews, competitor analysis, capacity modelling) live outside this repository.

## Key outcomes

1. **Modular monolith** over microservices for initial delivery — extract services only when a boundary proves stable and load justifies it (see [ADR-001](../decisions/ADR-001-modular-monolith.md)).
2. **PostgreSQL** as authoritative store; Redis for cache, locks, rate limits, and BullMQ — not for durable business state.
3. **Native API** at `/api/v1` is the primary integration surface; **ChannelEngine `/api/v2`** is a compatibility facade deferred to a later phase.
4. **Multi-tenant** data model with row-level security planned; tenant context helper created in migration `0001`.
5. **At-least-once events** via transactional outbox; consumers must deduplicate via inbox.
6. **Node 24** target runtime for production deployments.

## Gate criteria (all met)

| Criterion                     | Result                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| Architecture direction agreed | Modular monolith + bounded modules                           |
| Data store selection          | PostgreSQL + Redis + S3-compatible object storage            |
| Event delivery semantics      | At-least-once with idempotent consumers                      |
| API versioning strategy       | `/api/v1` native; `/api/v2` compatibility deferred           |
| Phase 1 scope bounded         | Foundation only, no business modules                         |
| Risk register reviewed        | Open items tracked in [open-questions.md](open-questions.md) |

## Next phase

Phase 1 (this repository) implements the runtime foundation documented in [requirements.md](requirements.md) and [overview.md](overview.md). Business modules begin in Phase 2 once foundation verification passes.
