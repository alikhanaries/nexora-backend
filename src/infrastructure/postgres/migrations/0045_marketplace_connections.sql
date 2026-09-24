-- Phase 21: tenant-scoped marketplace connections (encrypted credentials).

CREATE TABLE marketplace_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants (id),
  channel_id            uuid NOT NULL,
  marketplace_key       text NOT NULL,
  credentials_ciphertext text NOT NULL,
  configuration         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_connections_status_valid CHECK (status IN ('ACTIVE', 'DISABLED')),
  CONSTRAINT marketplace_connections_marketplace_key_format CHECK (marketplace_key ~ '^[a-z][a-z0-9_]*$')
);

CREATE UNIQUE INDEX marketplace_connections_active_unique
  ON marketplace_connections (tenant_id, channel_id, marketplace_key)
  WHERE status = 'ACTIVE';

CREATE INDEX marketplace_connections_tenant_channel_idx
  ON marketplace_connections (tenant_id, channel_id);

ALTER TABLE marketplace_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_connections_tenant_isolation ON marketplace_connections
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE marketplace_entity_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants (id),
  channel_id            uuid NOT NULL,
  marketplace_key       text NOT NULL,
  nexora_entity_type    text NOT NULL,
  nexora_entity_id      uuid NOT NULL,
  external_entity_type  text NOT NULL,
  external_entity_id    text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_entity_mappings_nexora_type_valid CHECK (
    nexora_entity_type IN ('product', 'offer', 'stock_location')
  ),
  CONSTRAINT marketplace_entity_mappings_marketplace_key_format CHECK (
    marketplace_key ~ '^[a-z][a-z0-9_]*$'
  )
);

CREATE UNIQUE INDEX marketplace_entity_mappings_unique
  ON marketplace_entity_mappings (
    tenant_id,
    channel_id,
    marketplace_key,
    nexora_entity_type,
    nexora_entity_id
  );

CREATE INDEX marketplace_entity_mappings_external_lookup_idx
  ON marketplace_entity_mappings (
    tenant_id,
    channel_id,
    marketplace_key,
    external_entity_type,
    external_entity_id
  );

ALTER TABLE marketplace_entity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_entity_mappings_tenant_isolation ON marketplace_entity_mappings
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
