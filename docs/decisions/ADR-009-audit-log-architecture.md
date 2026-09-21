# ADR-009: Audit Log Architecture

## Status

Accepted — deferred implementation to identity/audit phase.

## Context

ChannelEngine exposes audit logs; Nexora requires an auditable, scalable audit trail without blocking request paths.

## Decision

Audit records are append-only events written in the same transaction as state changes (alongside outbox events where needed). A dedicated audit module and API are implemented after identity foundations exist.

## Consequences

- Phase 1 provides outbox/inbox infrastructure reusable for audit export.
- No audit log tables or `/api/v2/auditlogs` in Phase 1.
- Audit retention and query scaling are addressed in the audit phase.
