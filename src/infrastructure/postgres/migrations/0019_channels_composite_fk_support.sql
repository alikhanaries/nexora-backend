-- Add composite unique on channels for same-tenant FK references from prices/offers.

ALTER TABLE channels
  ADD CONSTRAINT channels_tenant_id_unique UNIQUE (tenant_id, id);
