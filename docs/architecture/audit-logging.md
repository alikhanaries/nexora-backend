# Audit Logging

Audit logging records **who did what, to which resource, when** for compliance and forensic investigation. Phase 1 prepares hooks; the audit store and query API arrive with authentication in Phase 2.

## Goals

1. **Immutability** — audit records are append-only; corrections are new entries.
2. **Tamper evidence** — production deployments should restrict UPDATE/DELETE on audit tables (DB role permissions).
3. **Tenant scope** — every audit entry includes `tenant_id` where applicable.
4. **Correlation** — tie audit entries to `request_id` and `correlation_id`.

## Phase 1 foundation

What exists today:

| Capability                        | Status            |
| --------------------------------- | ----------------- |
| Structured request logging (Pino) | Implemented       |
| Request ID propagation            | Implemented       |
| Field redaction for secrets       | Implemented       |
| Dedicated `audit_log` table       | Not yet           |
| Actor identity in logs            | Not yet (no auth) |
| Audit query API                   | Not yet           |

HTTP request logs capture method, path, status, duration, and request ID. These are **operational logs**, not a compliance audit trail.

## Planned audit record shape (Phase 2)

```typescript
interface AuditEntry {
  id: string;
  tenantId: string | null;
  actorId: string; // user or service account
  actorType: 'user' | 'system' | 'api_key';
  action: string; // e.g. 'order.cancelled'
  resourceType: string;
  resourceId: string;
  changes: Record<string, unknown>; // before/after or delta
  requestId: string;
  correlationId: string | null;
  occurredAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}
```

## Write path (planned)

Audit entries will be written in the **same transaction** as the business mutation when the action is security-sensitive. For high-volume read actions, async write via outbox may be acceptable — decision per action type.

Application layer responsibility:

```typescript
// Inside use case, after auth middleware sets actor context
await auditRecorder.record({
  action: 'product.updated',
  resourceType: 'product',
  resourceId: product.id,
  changes: { name: { from: old.name, to: new.name } },
});
```

## Retention

- Operational logs: 30–90 days (environment-specific).
- Audit logs: 1–7 years depending on regulatory requirements — to be confirmed with legal/compliance.

Retention sweeps will be scheduled jobs, not manual deletes.

## Access control

- Audit read API restricted to admin roles.
- Audit write path internal only — never exposed as a public mutation endpoint.

## Integration with events

Significant audit-worthy actions may also emit integration events (e.g. `audit.action_recorded`) for SIEM ingestion. Event payload must not duplicate full PII if the SIEM is less trusted than PostgreSQL.

## Open items

See [open-questions.md](open-questions.md) for retention period and SIEM integration decisions.
