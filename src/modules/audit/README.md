# Audit Module

Append-only security audit trail for identity, authorization, and commerce events.

This module follows the **function-based MVC** layout (same pattern as `tenants/` / `api-keys/`).

## Layout

| Folder | Role |
| ------ | ---- |
| `routes/` | Endpoint method + path registry only |
| `controllers/nest/` | Thin Nest HTTP adapter |
| `services/` | `createAuditService`, `createDefaultAuditRecorder`, helpers |
| `repositories/` | `createPostgresAuditRepository` |
| `models/` | Event type vocabulary + `reconstituteAuditEvent` |
| `views/` | HTTP Zod schemas + response mapper |

## Responsibilities

- Record security-sensitive events atomically within business transactions
- Redact secrets from metadata before persistence
- Query audit events for the current tenant (`audit.read` permission)

## Integration

Other modules depend on the recorder port from composition (`auditRecorder.record`):

```javascript
await auditRecorder.record(tx, {
  tenantId,
  actorKind: 'user',
  actorId: userId,
  eventType: 'LOGIN_SUCCESS',
  resourceType: 'user',
  resourceId: userId,
});
```

Metadata is redacted automatically — never pass raw passwords, tokens, or MFA secrets.

Public helpers: `auditRequestFields`, `noopAuditRecorder`, `AUDIT_EVENT_TYPES`, `createDefaultAuditRecorder`.

## API

Paths are declared in `routes/audit.routes.js`.

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/api/v1/audit` | `audit.read` |

## Storage

Records are written to the `audit_log` table (migration `0011`) with tenant RLS.
