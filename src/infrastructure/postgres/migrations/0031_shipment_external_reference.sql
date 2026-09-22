-- Provider-neutral external shipment reference for merchant/integration identifiers.
-- Nullable so native shipments without an external reference remain valid.

ALTER TABLE shipments
  ADD COLUMN external_reference text;

COMMENT ON COLUMN shipments.external_reference IS
  'Optional merchant/integration shipment reference. Unique per tenant when set.';

CREATE UNIQUE INDEX shipments_tenant_external_reference_unique
  ON shipments (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;
