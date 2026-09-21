-- Phase 3: PostgreSQL-authoritative inventory.

CREATE TABLE stock_locations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants (id),
  name               text NOT NULL,
  external_reference text,
  status             text NOT NULL DEFAULT 'ACTIVE',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stock_locations_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT stock_locations_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX stock_locations_tenant_status_idx ON stock_locations (tenant_id, status);
CREATE INDEX stock_locations_tenant_external_ref_idx ON stock_locations (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_locations_tenant_isolation ON stock_locations
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE inventory_balances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  stock_location_id uuid NOT NULL,
  product_id       uuid NOT NULL,
  on_hand          integer NOT NULL DEFAULT 0,
  reserved         integer NOT NULL DEFAULT 0,
  available        integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inventory_balances_location_tenant_fk
    FOREIGN KEY (tenant_id, stock_location_id) REFERENCES stock_locations (tenant_id, id),
  CONSTRAINT inventory_balances_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id),
  CONSTRAINT inventory_balances_unique UNIQUE (tenant_id, stock_location_id, product_id),
  CONSTRAINT inventory_balances_on_hand_nonneg CHECK (on_hand >= 0),
  CONSTRAINT inventory_balances_reserved_nonneg CHECK (reserved >= 0),
  CONSTRAINT inventory_balances_available_nonneg CHECK (available >= 0),
  CONSTRAINT inventory_balances_invariant CHECK (available = on_hand - reserved),
  CONSTRAINT inventory_balances_reserved_lte_on_hand CHECK (reserved <= on_hand)
);

CREATE INDEX inventory_balances_tenant_product_idx ON inventory_balances (tenant_id, product_id);
CREATE INDEX inventory_balances_tenant_location_idx ON inventory_balances (tenant_id, stock_location_id);

ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_balances_tenant_isolation ON inventory_balances
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE inventory_movements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  stock_location_id uuid NOT NULL,
  product_id       uuid NOT NULL,
  movement_type    text NOT NULL,
  quantity         integer NOT NULL,
  reference_type   text,
  reference_id     text,
  idempotency_key  text,
  metadata         jsonb NOT NULL DEFAULT '{}',
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inventory_movements_type_valid CHECK (
    movement_type IN (
      'RECEIPT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE',
      'SALE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT'
    )
  ),
  CONSTRAINT inventory_movements_quantity_positive CHECK (quantity > 0),
  CONSTRAINT inventory_movements_location_tenant_fk
    FOREIGN KEY (tenant_id, stock_location_id) REFERENCES stock_locations (tenant_id, id),
  CONSTRAINT inventory_movements_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id)
);

CREATE INDEX inventory_movements_tenant_product_occurred_idx
  ON inventory_movements (tenant_id, product_id, occurred_at DESC);
CREATE INDEX inventory_movements_tenant_location_occurred_idx
  ON inventory_movements (tenant_id, stock_location_id, occurred_at DESC);
CREATE INDEX inventory_movements_reference_idx
  ON inventory_movements (tenant_id, reference_type, reference_id)
  WHERE reference_type IS NOT NULL;
CREATE UNIQUE INDEX inventory_movements_idempotency_unique
  ON inventory_movements (tenant_id, reference_type, reference_id, movement_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND reference_type IS NOT NULL AND reference_id IS NOT NULL;

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_tenant_isolation ON inventory_movements
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE inventory_reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  stock_location_id uuid NOT NULL,
  product_id       uuid NOT NULL,
  reference_type   text NOT NULL,
  reference_id     text NOT NULL,
  quantity         integer NOT NULL,
  status           text NOT NULL DEFAULT 'ACTIVE',
  created_at       timestamptz NOT NULL DEFAULT now(),
  released_at      timestamptz,

  CONSTRAINT inventory_reservations_status_valid CHECK (status IN ('ACTIVE', 'RELEASED')),
  CONSTRAINT inventory_reservations_quantity_positive CHECK (quantity > 0),
  CONSTRAINT inventory_reservations_location_tenant_fk
    FOREIGN KEY (tenant_id, stock_location_id) REFERENCES stock_locations (tenant_id, id),
  CONSTRAINT inventory_reservations_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id),
  CONSTRAINT inventory_reservations_reference_unique
    UNIQUE (tenant_id, reference_type, reference_id, stock_location_id, product_id)
);

CREATE INDEX inventory_reservations_tenant_product_idx ON inventory_reservations (tenant_id, product_id);

ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_reservations_tenant_isolation ON inventory_reservations
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE inventory_balances IS
  'Authoritative inventory. available = on_hand - reserved (stored and enforced).';
COMMENT ON TABLE inventory_reservations IS
  'Tracks active reservations by business reference for idempotent reserve/release.';
