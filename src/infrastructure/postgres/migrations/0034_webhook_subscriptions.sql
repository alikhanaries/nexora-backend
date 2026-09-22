-- Phase 6.2: Tenant-scoped webhook subscriptions for external event delivery.

CREATE TABLE webhook_subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants (id),
  url               text NOT NULL,
  description       text,
  secret_ciphertext text NOT NULL,
  event_types       text[] NOT NULL,
  status            text NOT NULL DEFAULT 'ACTIVE',
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT webhook_subscriptions_status_valid
    CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED')),
  CONSTRAINT webhook_subscriptions_event_types_non_empty
    CHECK (cardinality(event_types) >= 1),
  CONSTRAINT webhook_subscriptions_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX webhook_subscriptions_tenant_status_idx
  ON webhook_subscriptions (tenant_id, status);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_tenant_isolation ON webhook_subscriptions
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE webhook_subscriptions IS
  'Tenant webhook endpoint subscriptions. Signing secrets are stored encrypted; plaintext is shown once at creation in a later admin API slice.';
