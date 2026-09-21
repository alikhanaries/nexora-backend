# Tenants module

Global tenant registry for Nexora. Tenants are platform-level records — the `tenants` table is **not** tenant-scoped and has no row-level security policy.

## Lifecycle

```
ACTIVE ──suspend──▶ SUSPENDED ──reactivate──▶ ACTIVE
   │                     │
   └──────close──────────┴──────close──────▶ CLOSED (terminal)
```

| Current status | Allowed transitions   |
| -------------- | --------------------- |
| `ACTIVE`       | `SUSPENDED`, `CLOSED` |
| `SUSPENDED`    | `ACTIVE`, `CLOSED`    |
| `CLOSED`       | _(none — terminal)_   |

Rules enforced in the domain entity (`Tenant.suspend`, `Tenant.reactivate`, `Tenant.close`):

- Invalid transitions throw `BusinessRuleError` (HTTP 422).
- Physical deletion is prohibited; use `close` to retire a tenant.
- New tenants are always created in `ACTIVE` status.

## Slug rules

Slugs are normalised with `normalizeTenantSlug` (trim + lowercase) and validated with `validateTenantSlug` before persistence. The database enforces the same format via check constraints.

## HTTP API

| Method | Path                                   | Use case           |
| ------ | -------------------------------------- | ------------------ |
| `POST` | `/api/v1/tenants`                      | `CreateTenant`     |
| `GET`  | `/api/v1/tenants/:tenantId`            | `GetTenant`        |
| `POST` | `/api/v1/tenants/:tenantId/suspend`    | `SuspendTenant`    |
| `POST` | `/api/v1/tenants/:tenantId/reactivate` | `ReactivateTenant` |
| `POST` | `/api/v1/tenants/:tenantId/close`      | `CloseTenant`      |

## Cross-module usage

Import use cases from the public API only:

```typescript
import { GetTenant } from '../tenants/public/index.js';
```

Do not import `PostgresTenantRepository` or route plugins from other modules.

## Persistence

Migration `0005_tenants.sql` defines the `tenants` table. The PostgreSQL adapter lives in `infrastructure/postgres-tenant-repository.ts` and accepts `Queryable` / `Transaction` ports from `shared/persistence`.
