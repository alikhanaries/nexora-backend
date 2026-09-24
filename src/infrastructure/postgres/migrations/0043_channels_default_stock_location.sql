-- Phase 9: Explicit default stock location for channel order ingest (OQ-7-07).

ALTER TABLE channels
  ADD COLUMN default_stock_location_id uuid;

ALTER TABLE channels
  ADD CONSTRAINT channels_default_stock_location_fk
    FOREIGN KEY (tenant_id, default_stock_location_id)
    REFERENCES stock_locations (tenant_id, id);

CREATE INDEX channels_tenant_default_stock_location_idx
  ON channels (tenant_id, default_stock_location_id)
  WHERE default_stock_location_id IS NOT NULL;

COMMENT ON COLUMN channels.default_stock_location_id IS
  'Default Nexora stock location for channel ingest lines. When set, takes precedence over configuration_reference UUID convention.';
