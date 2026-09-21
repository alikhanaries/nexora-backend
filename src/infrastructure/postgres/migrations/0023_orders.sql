-- Phase 4: Orders, order lines, customer snapshots, tenant order numbers.

CREATE TABLE tenant_order_sequences (
  tenant_id   uuid PRIMARY KEY REFERENCES tenants (id),
  last_value  bigint NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants (id),
  channel_id              uuid NOT NULL,
  external_order_reference text,
  order_number            text NOT NULL,
  status                  text NOT NULL DEFAULT 'CONFIRMED',
  currency                text NOT NULL,
  subtotal_minor          bigint NOT NULL,
  discount_minor          bigint NOT NULL DEFAULT 0,
  tax_minor               bigint NOT NULL DEFAULT 0,
  shipping_minor          bigint NOT NULL DEFAULT 0,
  total_minor             bigint NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  confirmed_at            timestamptz,
  cancelled_at            timestamptz,
  shipped_at              timestamptz,
  delivered_at            timestamptz,

  CONSTRAINT orders_status_valid CHECK (
    status IN (
      'NEW', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP',
      'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'
    )
  ),
  CONSTRAINT orders_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT orders_subtotal_nonneg CHECK (subtotal_minor >= 0),
  CONSTRAINT orders_discount_nonneg CHECK (discount_minor >= 0),
  CONSTRAINT orders_tax_nonneg CHECK (tax_minor >= 0),
  CONSTRAINT orders_shipping_nonneg CHECK (shipping_minor >= 0),
  CONSTRAINT orders_total_nonneg CHECK (total_minor >= 0),
  CONSTRAINT orders_total_invariant CHECK (
    total_minor = subtotal_minor - discount_minor + tax_minor + shipping_minor
  ),
  CONSTRAINT orders_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT orders_tenant_order_number_unique UNIQUE (tenant_id, order_number)
);

CREATE UNIQUE INDEX orders_tenant_channel_external_ref_unique
  ON orders (tenant_id, channel_id, external_order_reference)
  WHERE external_order_reference IS NOT NULL;

CREATE INDEX orders_tenant_status_idx ON orders (tenant_id, status);
CREATE INDEX orders_tenant_channel_idx ON orders (tenant_id, channel_id);
CREATE INDEX orders_tenant_created_idx ON orders (tenant_id, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE order_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  order_id              uuid NOT NULL,
  product_id            uuid NOT NULL,
  offer_id              uuid,
  stock_location_id     uuid NOT NULL,
  merchant_sku          text NOT NULL,
  product_type_snapshot text NOT NULL,
  quantity              integer NOT NULL,
  cancelled_quantity    integer NOT NULL DEFAULT 0,
  shipped_quantity      integer NOT NULL DEFAULT 0,
  returned_quantity     integer NOT NULL DEFAULT 0,
  unit_price_minor      bigint NOT NULL,
  discount_minor        bigint NOT NULL DEFAULT 0,
  tax_minor             bigint NOT NULL DEFAULT 0,
  line_total_minor      bigint NOT NULL,
  currency              text NOT NULL,
  status                text NOT NULL DEFAULT 'OPEN',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_lines_status_valid CHECK (status IN ('OPEN', 'CANCELLED', 'CLOSED')),
  CONSTRAINT order_lines_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_lines_cancelled_nonneg CHECK (cancelled_quantity >= 0),
  CONSTRAINT order_lines_shipped_nonneg CHECK (shipped_quantity >= 0),
  CONSTRAINT order_lines_returned_nonneg CHECK (returned_quantity >= 0),
  CONSTRAINT order_lines_unit_price_positive CHECK (unit_price_minor > 0),
  CONSTRAINT order_lines_discount_nonneg CHECK (discount_minor >= 0),
  CONSTRAINT order_lines_tax_nonneg CHECK (tax_minor >= 0),
  CONSTRAINT order_lines_line_total_nonneg CHECK (line_total_minor >= 0),
  CONSTRAINT order_lines_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT order_lines_quantities_valid CHECK (
    cancelled_quantity + shipped_quantity + returned_quantity <= quantity
  ),
  CONSTRAINT order_lines_order_tenant_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  CONSTRAINT order_lines_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX order_lines_tenant_order_idx ON order_lines (tenant_id, order_id);
CREATE INDEX order_lines_tenant_product_idx ON order_lines (tenant_id, product_id);

ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_lines_tenant_isolation ON order_lines
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE order_customer_snapshots (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  order_id                  uuid NOT NULL,
  external_customer_reference text,
  first_name                text,
  last_name                 text,
  email                     text,
  phone                     text,
  company_name              text,
  billing_address           jsonb,
  shipping_address          jsonb,
  metadata                  jsonb NOT NULL DEFAULT '{}',
  created_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_customer_snapshots_order_tenant_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id),
  CONSTRAINT order_customer_snapshots_order_unique UNIQUE (order_id)
);

CREATE INDEX order_customer_snapshots_tenant_order_idx
  ON order_customer_snapshots (tenant_id, order_id);

ALTER TABLE order_customer_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_customer_snapshots_tenant_isolation ON order_customer_snapshots
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE order_customer_snapshots IS
  'Immutable customer data captured at order creation. Not a canonical customer registry.';
COMMENT ON TABLE orders IS
  'Tenant orders with snapshotted monetary totals. Phase 3 entities resolved via public contracts.';
