-- Phase 4: Shipments and shipment lines.

CREATE TABLE shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  order_id        uuid NOT NULL,
  carrier         text,
  service         text,
  tracking_number text,
  status          text NOT NULL DEFAULT 'CREATED',
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shipments_status_valid CHECK (
    status IN ('CREATED', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED')
  ),
  CONSTRAINT shipments_order_tenant_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  CONSTRAINT shipments_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX shipments_tenant_order_idx ON shipments (tenant_id, order_id);
CREATE INDEX shipments_tenant_status_idx ON shipments (tenant_id, status);
CREATE INDEX shipments_tenant_tracking_idx ON shipments (tenant_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipments_tenant_isolation ON shipments
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE shipment_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  shipment_id   uuid NOT NULL,
  order_line_id uuid NOT NULL,
  quantity      integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shipment_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT shipment_lines_shipment_tenant_fk
    FOREIGN KEY (tenant_id, shipment_id) REFERENCES shipments (tenant_id, id),
  CONSTRAINT shipment_lines_order_line_tenant_fk
    FOREIGN KEY (tenant_id, order_line_id) REFERENCES order_lines (tenant_id, id)
);

CREATE INDEX shipment_lines_tenant_shipment_idx ON shipment_lines (tenant_id, shipment_id);
CREATE INDEX shipment_lines_tenant_order_line_idx ON shipment_lines (tenant_id, order_line_id);

ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipment_lines_tenant_isolation ON shipment_lines
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
