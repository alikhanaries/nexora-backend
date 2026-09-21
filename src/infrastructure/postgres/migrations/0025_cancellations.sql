-- Phase 4: Cancellations and cancellation lines.

CREATE TABLE cancellations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  order_id    uuid NOT NULL,
  status      text NOT NULL DEFAULT 'REQUESTED',
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  CONSTRAINT cancellations_status_valid CHECK (
    status IN ('REQUESTED', 'COMPLETED', 'REJECTED')
  ),
  CONSTRAINT cancellations_order_tenant_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  CONSTRAINT cancellations_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX cancellations_tenant_order_idx ON cancellations (tenant_id, order_id);
CREATE INDEX cancellations_tenant_status_idx ON cancellations (tenant_id, status);

ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cancellations_tenant_isolation ON cancellations
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE cancellation_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  cancellation_id uuid NOT NULL,
  order_line_id   uuid NOT NULL,
  quantity        integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cancellation_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT cancellation_lines_cancellation_tenant_fk
    FOREIGN KEY (tenant_id, cancellation_id) REFERENCES cancellations (tenant_id, id),
  CONSTRAINT cancellation_lines_order_line_tenant_fk
    FOREIGN KEY (tenant_id, order_line_id) REFERENCES order_lines (tenant_id, id)
);

CREATE INDEX cancellation_lines_tenant_cancellation_idx
  ON cancellation_lines (tenant_id, cancellation_id);

ALTER TABLE cancellation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY cancellation_lines_tenant_isolation ON cancellation_lines
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
