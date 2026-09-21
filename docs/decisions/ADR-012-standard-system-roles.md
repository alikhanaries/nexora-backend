# ADR-012: Standard System Roles

**Status:** Accepted  
**Date:** 2025-09-21

## Context

Every tenant needs a consistent baseline of roles for administration, operations, read-only access, auditing, and integration workloads. Role names are display labels only — authorization checks use permission keys.

Phase 2C seeds seven immutable system roles per tenant when the tenant is provisioned (via `SystemRoleSeeder`).

## Decision

Seed the following system roles with `system_key` and `is_system = true`:

| system_key             | Display name         | Permission patterns                                                         |
| ---------------------- | -------------------- | --------------------------------------------------------------------------- |
| `owner`                | Owner                | All permissions in the catalog                                              |
| `administrator`        | Administrator        | `tenant.admin`, `users.*`, `roles.*`, `audit.*`, `api_keys.*`, `mfa.manage` |
| `operations_manager`   | Operations Manager   | `orders.*`, `products.*`, `inventory.*`, `shipments.*`, `returns.*`         |
| `fulfillment_operator` | Fulfillment Operator | `orders.read`, `inventory.*`, `shipments.*`                                 |
| `viewer`               | Viewer               | All `*.read` permissions                                                    |
| `auditor`              | Auditor              | `audit.*`, `users.read`, `roles.read`                                       |
| `integration`          | Integration          | `channels.*`, `products.read`, `orders.read`, `inventory.read`              |

Pattern semantics at seed time:

- `*` suffix on a segment prefix (e.g. `orders.*`) grants every permission key starting with `orders.`
- `*.read` suffix pattern grants every permission key ending with `.read`
- `all` grants the entire catalog

Wildcards are expanded to concrete permission keys when roles are created. Runtime authorization never matches wildcards — only resolved keys.

## Consequences

**Positive**

- Predictable onboarding for every tenant
- Permission-based checks remain the security boundary
- Custom roles can be added without changing system templates

**Negative**

- New permissions added to the catalog do not automatically appear on existing system roles until a deliberate re-seed or migration updates them
- `owner` with full catalog access is powerful; assignment must be tightly controlled

## Last-admin invariant

Removing a role that grants `tenant.admin` from the last active membership holding that capability is blocked with `BusinessRuleError`. Enforcement uses `SELECT FOR UPDATE` on admin-capable memberships inside the same transaction as the removal.

## Related

- Migration `0007_roles_and_permissions.sql`
- `src/modules/authorization/application/system-role-seeder.ts`
- `src/modules/authorization/domain/system-role-templates.ts`
