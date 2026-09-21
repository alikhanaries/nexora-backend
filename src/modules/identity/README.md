# Identity Module

Global user identities, tenant memberships, password authentication, refresh sessions, and password reset foundation.

## Model

- **Users** are globally unique (`normalized_email` uniqueness enforced in PostgreSQL).
- **Tenant memberships** link users to tenants with lifecycle: `PENDING` → `ACTIVE` | `SUSPENDED` | `REVOKED`.
- **Password credentials** use Argon2id; hashes are never returned from repositories.
- **Refresh sessions** store only token hashes with rotation and family reuse detection.

## Authentication

Native endpoints under `/api/v1/auth`:

| Method | Path       | Description                    |
| ------ | ---------- | ------------------------------ |
| POST   | `/login`   | Email + password + tenant slug |
| POST   | `/refresh` | Rotate refresh token           |
| POST   | `/logout`  | Revoke refresh session         |
| GET    | `/me`      | Current authenticated user     |

Login failures always return a generic `Invalid credentials` message.

## Tenant context

Membership and session operations run inside tenant-scoped transactions (`set_config('app.tenant_id', …, true)`).

## Extension points

- `PasswordResetNotifier` port for future email integration.
- `TenantLookup` port for resolving tenant slug during login.

## Prohibited dependencies

Domain and application layers must not import infrastructure adapters or Fastify.
