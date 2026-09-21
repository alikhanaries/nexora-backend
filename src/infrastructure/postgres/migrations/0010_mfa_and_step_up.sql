-- Phase 2F: MFA factors, recovery codes, and step-up evidence.

CREATE TABLE mfa_factors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id),
  tenant_id       uuid NOT NULL REFERENCES tenants (id),
  factor_type     text NOT NULL DEFAULT 'TOTP',
  status          text NOT NULL DEFAULT 'PENDING',
  secret_encrypted text NOT NULL,
  label           text NOT NULL DEFAULT 'Authenticator',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  activated_at    timestamptz,
  revoked_at      timestamptz,

  CONSTRAINT mfa_factors_type_valid CHECK (factor_type IN ('TOTP')),
  CONSTRAINT mfa_factors_status_valid CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED'))
);

CREATE INDEX mfa_factors_user_status_idx ON mfa_factors (user_id, status);
CREATE INDEX mfa_factors_tenant_user_idx ON mfa_factors (tenant_id, user_id);

ALTER TABLE mfa_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY mfa_factors_tenant_isolation ON mfa_factors
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE recovery_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  tenant_id  uuid NOT NULL REFERENCES tenants (id),
  code_hash  text NOT NULL,
  status     text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,

  CONSTRAINT recovery_codes_status_valid CHECK (status IN ('ACTIVE', 'USED', 'REVOKED'))
);

CREATE UNIQUE INDEX recovery_codes_code_hash_unique ON recovery_codes (code_hash);
CREATE INDEX recovery_codes_user_id_idx ON recovery_codes (user_id);

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recovery_codes_tenant_isolation ON recovery_codes
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE step_up_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id),
  tenant_id    uuid NOT NULL REFERENCES tenants (id),
  session_id   uuid NOT NULL,
  verified_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,

  CONSTRAINT step_up_sessions_user_tenant_session_unique
    UNIQUE (user_id, tenant_id, session_id)
);

CREATE INDEX step_up_sessions_expires_at_idx ON step_up_sessions (expires_at);

ALTER TABLE step_up_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY step_up_sessions_tenant_isolation ON step_up_sessions
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
