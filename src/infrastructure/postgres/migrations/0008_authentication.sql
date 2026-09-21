-- Phase 2D: Password credentials and refresh sessions.

CREATE TABLE password_credentials (
  user_id       uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id),
  tenant_id     uuid NOT NULL REFERENCES tenants (id),
  token_hash    text NOT NULL,
  family_id     uuid NOT NULL,
  status        text NOT NULL DEFAULT 'ACTIVE',
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  replaced_by   uuid REFERENCES refresh_sessions (id),

  CONSTRAINT refresh_sessions_status_valid
    CHECK (status IN ('ACTIVE', 'REVOKED', 'REPLACED'))
);

CREATE UNIQUE INDEX refresh_sessions_token_hash_unique ON refresh_sessions (token_hash);
CREATE INDEX refresh_sessions_user_id_idx ON refresh_sessions (user_id);
CREATE INDEX refresh_sessions_family_id_idx ON refresh_sessions (family_id);
CREATE INDEX refresh_sessions_tenant_status_idx ON refresh_sessions (tenant_id, status);

ALTER TABLE refresh_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_sessions_tenant_isolation ON refresh_sessions
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL,
  status     text NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,

  CONSTRAINT password_reset_tokens_status_valid
    CHECK (status IN ('ACTIVE', 'USED', 'REVOKED'))
);

CREATE UNIQUE INDEX password_reset_tokens_token_hash_unique ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
