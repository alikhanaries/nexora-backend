-- Phase 22: FK hardening, connection test metadata, external mapping uniqueness.

ALTER TABLE marketplace_connections
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_outcome text,
  ADD COLUMN IF NOT EXISTS last_test_error text,
  ADD CONSTRAINT marketplace_connections_last_test_outcome_valid CHECK (
    last_test_outcome IS NULL OR last_test_outcome IN ('SUCCESS', 'FAILURE')
  );

ALTER TABLE marketplace_connections
  ADD CONSTRAINT marketplace_connections_channel_fk
  FOREIGN KEY (tenant_id, channel_id) REFERENCES channels (tenant_id, id);

ALTER TABLE marketplace_entity_mappings
  ADD CONSTRAINT marketplace_entity_mappings_channel_fk
  FOREIGN KEY (tenant_id, channel_id) REFERENCES channels (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_entity_mappings_external_unique
  ON marketplace_entity_mappings (
    tenant_id,
    channel_id,
    marketplace_key,
    external_entity_type,
    external_entity_id
  );
