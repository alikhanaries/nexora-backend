-- Phase 10: Indexes to support bounded webhook delivery history retention sweeps.

CREATE INDEX webhook_deliveries_delivered_retention_idx
  ON webhook_deliveries (tenant_id, delivered_at, id)
  WHERE status = 'DELIVERED';

CREATE INDEX webhook_deliveries_dead_letter_retention_idx
  ON webhook_deliveries (tenant_id, created_at, id)
  WHERE status = 'DEAD_LETTERED';

COMMENT ON INDEX webhook_deliveries_delivered_retention_idx IS
  'Supports tenant-scoped retention deletes for DELIVERED webhook delivery rows.';

COMMENT ON INDEX webhook_deliveries_dead_letter_retention_idx IS
  'Supports tenant-scoped retention deletes for DEAD_LETTERED webhook delivery rows.';
