-- Provider-neutral external cancellation reference for merchant/integration identifiers.
-- Nullable so native cancellations without an external reference remain valid.

ALTER TABLE cancellations
  ADD COLUMN external_reference text;

COMMENT ON COLUMN cancellations.external_reference IS
  'Optional merchant/integration cancellation reference. Unique per tenant when set.';

CREATE UNIQUE INDEX cancellations_tenant_external_reference_unique
  ON cancellations (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;
