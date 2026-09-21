-- Phase 2G: Append-only security audit log.

CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants (id),
  actor_kind  text NOT NULL,
  actor_id    text,
  event_type  text NOT NULL,
  resource_type text,
  resource_id text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  ip_address  inet,
  request_id  text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_log_actor_kind_valid
    CHECK (actor_kind IN ('user', 'api-key', 'system'))
);

CREATE INDEX audit_log_tenant_created_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_event_type_idx ON audit_log (event_type);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_kind, actor_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR ALL
  USING (
    tenant_id IS NULL
    OR tenant_id = app.current_tenant_id()
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = app.current_tenant_id()
  );

COMMENT ON TABLE audit_log IS
  'Append-only security audit trail. Secrets must never be stored in metadata.';
