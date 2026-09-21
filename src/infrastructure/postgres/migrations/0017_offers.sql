-- Phase 3: Tenant-owned channel product offers.

CREATE TABLE offers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  product_id         uuid NOT NULL,
  channel_id         uuid NOT NULL,
  status             text NOT NULL DEFAULT 'DRAFT',
  external_reference text,
  price_reference    uuid,
  listing_status     text NOT NULL DEFAULT 'UNLISTED',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offers_status_valid CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED')),
  CONSTRAINT offers_listing_status_valid CHECK (listing_status IN ('UNLISTED', 'LISTED', 'DELISTED')),
  CONSTRAINT offers_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id),
  CONSTRAINT offers_tenant_product_channel_unique UNIQUE (tenant_id, product_id, channel_id)
);

CREATE INDEX offers_tenant_product_idx ON offers (tenant_id, product_id);
CREATE INDEX offers_tenant_channel_idx ON offers (tenant_id, channel_id);
CREATE INDEX offers_tenant_status_idx ON offers (tenant_id, status);
CREATE INDEX offers_tenant_external_ref_idx ON offers (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY offers_tenant_isolation ON offers
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE offers IS
  'Sellable product representation on a channel. Price/inventory resolved via services.';
