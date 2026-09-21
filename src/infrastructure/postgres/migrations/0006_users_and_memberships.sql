-- Phase 2B: Global users and tenant memberships.

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  normalized_email text NOT NULL,
  status           text NOT NULL DEFAULT 'ACTIVE',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_status_valid CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  CONSTRAINT users_normalized_email_format CHECK (normalized_email = lower(trim(normalized_email)))
);

CREATE UNIQUE INDEX users_normalized_email_unique ON users (normalized_email);

CREATE TABLE tenant_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants (id),
  user_id    uuid NOT NULL REFERENCES users (id),
  status     text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_memberships_status_valid
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT tenant_memberships_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX tenant_memberships_tenant_id_idx ON tenant_memberships (tenant_id);
CREATE INDEX tenant_memberships_user_id_idx ON tenant_memberships (user_id);
CREATE INDEX tenant_memberships_tenant_status_idx ON tenant_memberships (tenant_id, status);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_memberships_tenant_isolation ON tenant_memberships
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE tenant_memberships IS
  'Links global users to tenants. PENDING/SUSPENDED/REVOKED deny access; '
  'REVOKED is terminal and must not be silently recreated.';
