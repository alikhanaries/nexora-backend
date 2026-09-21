-- Phase 3: Tenant-scoped product pricing in minor units.

CREATE TABLE prices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  product_id   uuid NOT NULL,
  channel_id   uuid,
  currency     text NOT NULL,
  amount_minor bigint NOT NULL,
  valid_from   timestamptz NOT NULL DEFAULT now(),
  valid_to     timestamptz,
  status       text NOT NULL DEFAULT 'ACTIVE',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT prices_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT prices_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT prices_amount_minor_positive CHECK (amount_minor > 0),
  CONSTRAINT prices_valid_range CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT prices_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id)
);

CREATE INDEX prices_tenant_product_idx ON prices (tenant_id, product_id);
CREATE INDEX prices_tenant_channel_idx ON prices (tenant_id, channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX prices_lookup_idx ON prices (tenant_id, product_id, channel_id, currency, status, valid_from DESC);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY prices_tenant_isolation ON prices
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE prices IS
  'Price in integer minor units. valid_from inclusive, valid_to exclusive when set.';
