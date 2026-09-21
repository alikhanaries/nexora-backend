-- Phase 3: Tenant-owned products and localized content.

CREATE TABLE products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants (id),
  merchant_sku       text NOT NULL,
  external_reference text,
  product_type       text NOT NULL DEFAULT 'STANDARD',
  status             text NOT NULL DEFAULT 'ACTIVE',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT products_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  CONSTRAINT products_type_valid CHECK (product_type IN ('STANDARD', 'BUNDLE', 'VARIANT')),
  CONSTRAINT products_tenant_id_unique UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX products_tenant_merchant_sku_unique ON products (tenant_id, merchant_sku);
CREATE INDEX products_tenant_status_idx ON products (tenant_id, status);
CREATE INDEX products_tenant_external_ref_idx ON products (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant_isolation ON products
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

CREATE TABLE product_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL,
  tenant_id   uuid NOT NULL,
  locale      text NOT NULL,
  title       text,
  description text,
  brand       text,
  attributes  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_content_locale_format CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT product_content_product_tenant_fk
    FOREIGN KEY (tenant_id, product_id) REFERENCES products (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT product_content_product_locale_unique UNIQUE (product_id, locale)
);

CREATE INDEX product_content_tenant_product_idx ON product_content (tenant_id, product_id);

ALTER TABLE product_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_content_tenant_isolation ON product_content
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE product_content IS
  'Localized product content. attributes JSONB is for flexible attributes only — not SKU/price/stock.';
