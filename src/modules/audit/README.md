# Audit Module

Phase 2G — append-only security audit trail for identity and authorization events.

## Responsibilities

- Record security-sensitive events atomically within business transactions
- Redact secrets from metadata before persistence
- Query audit events for the current tenant (`audit.read` permission)

## Event types

Events follow the Phase 2 security vocabulary, including:

- User and membership lifecycle (`USER_CREATED`, `MEMBERSHIP_ACTIVATED`, …)
- Role changes (`ROLE_ASSIGNED`, `ROLE_REMOVED`, …)
- Authentication (`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `REFRESH_REUSE_DETECTED`)
- API keys (`API_KEY_CREATED`, `API_KEY_ROTATED`, `API_KEY_REVOKED`)
- MFA (`MFA_ENABLED`, `MFA_DISABLED`, `MFA_STEP_UP`)

## Integration

Other modules depend on the `AuditRecorder` port from `public/index.ts`:

```typescript
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

## API

| Method | Path            | Permission   |
| ------ | --------------- | ------------ |
| GET    | `/api/v1/audit` | `audit.read` |

## Storage

Records are written to the `audit_log` table (migration `0011`) with tenant RLS.
