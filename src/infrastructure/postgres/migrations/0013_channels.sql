-- Phase 3: Tenant-owned sales channels linked to global marketplaces.

CREATE TABLE channels (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants (id),
  marketplace_id         uuid NOT NULL REFERENCES marketplaces (id),
  name                   text NOT NULL,
  external_reference     text,
  status                 text NOT NULL DEFAULT 'ACTIVE',
  configuration_reference text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT channels_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

CREATE INDEX channels_tenant_id_idx ON channels (tenant_id);
CREATE INDEX channels_tenant_marketplace_idx ON channels (tenant_id, marketplace_id);
CREATE INDEX channels_tenant_status_idx ON channels (tenant_id, status);
CREATE INDEX channels_tenant_external_ref_idx ON channels (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY channels_tenant_isolation ON channels
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE channels IS
  'Tenant connection to a marketplace. No raw credentials — use configuration_reference.';
