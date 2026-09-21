-- Same-tenant composite foreign keys for Phase 4 cross-module references.

ALTER TABLE offers
  ADD CONSTRAINT offers_tenant_id_unique UNIQUE (tenant_id, id);

ALTER TABLE orders
  ADD CONSTRAINT orders_channel_tenant_fk
  FOREIGN KEY (tenant_id, channel_id) REFERENCES channels (tenant_id, id);

ALTER TABLE order_lines
  ADD CONSTRAINT order_lines_product_tenant_fk
  FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id);

ALTER TABLE order_lines
  ADD CONSTRAINT order_lines_stock_location_tenant_fk
  FOREIGN KEY (tenant_id, stock_location_id) REFERENCES stock_locations (tenant_id, id);

ALTER TABLE order_lines
  ADD CONSTRAINT order_lines_offer_tenant_fk
  FOREIGN KEY (tenant_id, offer_id) REFERENCES offers (tenant_id, id);

ALTER TABLE returns
  ADD CONSTRAINT returns_shipment_tenant_fk
  FOREIGN KEY (tenant_id, shipment_id) REFERENCES shipments (tenant_id, id);
