-- Provider-neutral external return reference for merchant/integration identifiers.
-- Nullable so native returns without an external reference remain valid.

ALTER TABLE returns
  ADD COLUMN external_reference text;

COMMENT ON COLUMN returns.external_reference IS
  'Optional merchant/integration return reference. Unique per tenant when set.';

CREATE UNIQUE INDEX returns_tenant_external_reference_unique
  ON returns (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;
