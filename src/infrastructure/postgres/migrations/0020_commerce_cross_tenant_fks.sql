-- Same-tenant FK constraints requiring channels(tenant_id, id) unique (0019).

ALTER TABLE prices
  ADD CONSTRAINT prices_channel_tenant_fk
  FOREIGN KEY (tenant_id, channel_id) REFERENCES channels (tenant_id, id);

ALTER TABLE offers
  ADD CONSTRAINT offers_channel_tenant_fk
  FOREIGN KEY (tenant_id, channel_id) REFERENCES channels (tenant_id, id);
