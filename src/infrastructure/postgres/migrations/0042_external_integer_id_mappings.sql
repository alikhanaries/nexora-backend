-- Phase 8.1: External integer ID mapping persistence and allocation.

CREATE TABLE external_integer_id_sequences (
  tenant_id      uuid NOT NULL REFERENCES tenants (id),
  provider       text NOT NULL,
  resource_type  text NOT NULL,
  last_value     bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, provider, resource_type),
  CONSTRAINT external_integer_id_sequences_provider_valid
    CHECK (provider IN ('compat_v2')),
  CONSTRAINT external_integer_id_sequences_resource_type_valid
    CHECK (resource_type IN ('order', 'order_line', 'return', 'shipment', 'cancellation')),
  CONSTRAINT external_integer_id_sequences_last_value_non_negative
    CHECK (last_value >= 0)
);

CREATE TABLE external_integer_id_mappings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants (id),
  provider       text NOT NULL,
  resource_type  text NOT NULL,
  resource_id    uuid NOT NULL,
  external_id    bigint NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT external_integer_id_mappings_provider_valid
    CHECK (provider IN ('compat_v2')),
  CONSTRAINT external_integer_id_mappings_resource_type_valid
    CHECK (resource_type IN ('order', 'order_line', 'return', 'shipment', 'cancellation')),
  CONSTRAINT external_integer_id_mappings_external_id_positive
    CHECK (external_id > 0)
);

CREATE UNIQUE INDEX external_integer_id_mappings_lookup_unique
  ON external_integer_id_mappings (tenant_id, provider, resource_type, external_id);

CREATE UNIQUE INDEX external_integer_id_mappings_resource_unique
  ON external_integer_id_mappings (tenant_id, provider, resource_type, resource_id);

ALTER TABLE external_integer_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_integer_id_mappings FORCE ROW LEVEL SECURITY;

CREATE POLICY external_integer_id_mappings_tenant_isolation ON external_integer_id_mappings
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE external_integer_id_sequences IS
  'Per-tenant, per-provider, per-resource-type counters for atomic external integer ID allocation. Not RLS-protected — accessed only via repository with explicit tenant_id.';

COMMENT ON TABLE external_integer_id_mappings IS
  'Maps Nexora resource UUIDs to compatibility-layer external integer IDs. Insert-only; rows are retained when resources are deleted to prevent ID reuse.';
