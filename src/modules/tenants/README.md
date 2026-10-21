# Tenants module

Global tenant registry for Wasl. Tenants are platform-level records — the `tenants` table is **not** tenant-scoped and has no row-level security policy.

This module is the **reference function-based MVC** layout for Wasl.

## Layout

| Folder | Role |
| ------ | ---- |
| `routes/` | Endpoint method + path registry only |
| `controllers/nest/` | Thin Nest HTTP adapters |
| `services/` | Business use-case factories (`createX`) |
| `repositories/` | Postgres access (`createPostgresTenantRepository`) |
| `models/` | Entity plain objects + pure transition functions |
| `views/` | HTTP Zod schemas + response mappers |

## Lifecycle

```
ACTIVE ──suspend──▶ SUSPENDED ──reactivate──▶ ACTIVE
   │                     │
   └──────close──────────┴──────close──────▶ CLOSED (terminal)
```

Rules enforced in model functions (`suspendTenantEntity`, `reactivateTenantEntity`, `closeTenantEntity`):

- Invalid transitions throw `BusinessRuleError` (HTTP 422).
- Physical deletion is prohibited; use `close` to retire a tenant.
- New tenants are always created in `ACTIVE` status.

## HTTP API

Paths are declared in `routes/tenant.routes.js` and wired by `controllers/nest/tenants.controller.js`.

| Method | Path | Use case |
| ------ | ---- | -------- |
| `POST` | `/api/v1/tenants` | `createCreateTenant` |
| `GET` | `/api/v1/tenants/:tenantId` | `createGetTenant` |
| `POST` | `/api/v1/tenants/:tenantId/suspend` | `createSuspendTenant` |
| `POST` | `/api/v1/tenants/:tenantId/reactivate` | `createReactivateTenant` |
| `POST` | `/api/v1/tenants/:tenantId/close` | `createCloseTenant` |

## Cross-module usage

```javascript
import { createGetTenant, createTenantEntity } from '../tenants/public/index.js';
```

Do not import the Postgres repository or Nest controller from other modules.
