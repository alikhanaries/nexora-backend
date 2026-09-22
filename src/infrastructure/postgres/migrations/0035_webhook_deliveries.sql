-- Phase 6.2: Delivery ledger for asynchronous webhook HTTP dispatch.

CREATE TABLE webhook_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  subscription_id  uuid NOT NULL,
  event_id         uuid NOT NULL,
  event_type       text NOT NULL,
  status           text NOT NULL DEFAULT 'PENDING',
  attempt_count    integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz,
  last_http_status integer,
  last_error       text,
  delivered_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT webhook_deliveries_status_valid
    CHECK (status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'DEAD_LETTERED')),
  CONSTRAINT webhook_deliveries_attempt_count_non_negative
    CHECK (attempt_count >= 0),
  CONSTRAINT webhook_deliveries_subscription_tenant_fk
    FOREIGN KEY (tenant_id, subscription_id) REFERENCES webhook_subscriptions (tenant_id, id),
  CONSTRAINT webhook_deliveries_subscription_event_unique
    UNIQUE (subscription_id, event_id)
);

CREATE INDEX webhook_deliveries_tenant_subscription_created_idx
  ON webhook_deliveries (tenant_id, subscription_id, created_at DESC);

CREATE INDEX webhook_deliveries_pending_worker_idx
  ON webhook_deliveries (status, next_attempt_at)
  WHERE status IN ('PENDING', 'FAILED');

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  FOR ALL
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

COMMENT ON TABLE webhook_deliveries IS
  'Webhook delivery attempts. One row per (subscription, integration event). HTTP dispatch is handled by a future worker on webhook-deliveries.';
