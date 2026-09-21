-- Phase 2A: Tenant registry (global table — not tenant-scoped).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'ACTIVE',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenants_slug_normalized CHECK (slug = lower(trim(slug))),
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  CONSTRAINT tenants_status_valid CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED'))
);

CREATE UNIQUE INDEX tenants_slug_unique ON tenants (slug);

CREATE INDEX tenants_status_idx ON tenants (status);

COMMENT ON TABLE tenants IS
  'Tenant registry. Lifecycle: ACTIVE → SUSPENDED → ACTIVE | CLOSED (terminal). '
  'Physical deletion is prohibited; use status transitions.';
