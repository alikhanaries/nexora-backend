-- Phase 2E: Tenant-scoped API keys.

CREATE TABLE api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  name            text NOT NULL,
  prefix          text NOT NULL,
  secret_hash     text NOT NULL,
  key_type        text NOT NULL DEFAULT 'STANDARD',
  scopes          text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'ACTIVE',
  channel_id      uuid,
  expires_at      timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  rotated_from_id uuid REFERENCES api_keys (id),

  CONSTRAINT api_keys_status_valid CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  CONSTRAINT api_keys_key_type_valid CHECK (key_type IN ('STANDARD', 'INTEGRATION'))
);

CREATE UNIQUE INDEX api_keys_prefix_unique ON api_keys (prefix);
CREATE INDEX api_keys_tenant_status_idx ON api_keys (tenant_id, status);
CREATE INDEX api_keys_secret_hash_idx ON api_keys (secret_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_isolation ON api_keys
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE api_keys IS
  'Tenant API keys. Raw secrets are shown once at creation/rotation only.';
