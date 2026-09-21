# Authorization Module

Phase 2C — permission-based authorization, tenant roles, and membership role assignments.

## Responsibilities

- Global permission catalog (read-only at runtime; seeded by migration `0007`)
- Tenant-scoped roles (seven immutable system roles + custom roles)
- Membership role assignments
- Effective permission resolution (union of active roles on active memberships)
- Last-admin invariant when removing `tenant.admin`

## Authorization model

Security boundaries are **permission keys**, never role names:

```typescript
authorizationService.requirePermission(principal.permissions, 'orders.read');
```

Effective permissions for a membership are computed as the sorted union of permission keys from all **ACTIVE** roles assigned to an **ACTIVE** membership.

## System roles

Seven system roles are seeded per tenant via `SystemRoleSeeder`. See [ADR-012](../../../docs/decisions/ADR-012-standard-system-roles.md).

## API

| Method | Path                                              | Permission     |
| ------ | ------------------------------------------------- | -------------- |
| GET    | `/api/v1/permissions`                             | `roles.read`   |
| GET    | `/api/v1/roles`                                   | `roles.read`   |
| POST   | `/api/v1/roles`                                   | `roles.manage` |
| GET    | `/api/v1/memberships/:membershipId/roles`         | `roles.read`   |
| POST   | `/api/v1/memberships/:membershipId/roles`         | `roles.manage` |
| DELETE | `/api/v1/memberships/:membershipId/roles/:roleId` | `roles.manage` |

## Public surface

Other modules import from `public/index.ts` only:

- `AuthorizationService` / `DefaultAuthorizationService`
- `SystemRoleSeeder`
- `resolveEffectivePermissions`

## Dependencies

- `shared/persistence` — transactions and tenant GUC
- `shared/errors` — `AuthorizationError`, `BusinessRuleError`
- Identity tables (`tenant_memberships`) via repository ports
