-- Phase 4: Returns and return lines.

CREATE TABLE returns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  order_id    uuid NOT NULL,
  shipment_id uuid,
  status      text NOT NULL DEFAULT 'REQUESTED',
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  completed_at timestamptz,

  CONSTRAINT returns_status_valid CHECK (
    status IN ('REQUESTED', 'APPROVED', 'RECEIVED', 'COMPLETED', 'REJECTED', 'CANCELLED')
  ),
  CONSTRAINT returns_order_tenant_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  CONSTRAINT returns_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX returns_tenant_order_idx ON returns (tenant_id, order_id);
CREATE INDEX returns_tenant_status_idx ON returns (tenant_id, status);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY returns_tenant_isolation ON returns
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE return_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  return_id     uuid NOT NULL,
  order_line_id uuid NOT NULL,
  quantity      integer NOT NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT return_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT return_lines_return_tenant_fk
    FOREIGN KEY (tenant_id, return_id) REFERENCES returns (tenant_id, id),
  CONSTRAINT return_lines_order_line_tenant_fk
    FOREIGN KEY (tenant_id, order_line_id) REFERENCES order_lines (tenant_id, id)
);

CREATE INDEX return_lines_tenant_return_idx ON return_lines (tenant_id, return_id);

ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY return_lines_tenant_isolation ON return_lines
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
