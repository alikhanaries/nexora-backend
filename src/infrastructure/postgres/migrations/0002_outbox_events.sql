-- Reason: the transactional outbox (ADR-005). Integration events are written
-- in the same transaction as the business change, then published by a separate
-- process. Without this table an event can be published for a transaction that
-- later rolls back, or lost when publishing fails after commit.

CREATE TABLE outbox_events (
  id               uuid        PRIMARY KEY,
  event_type       text        NOT NULL,
  event_version    integer     NOT NULL DEFAULT 1,
  aggregate_type   text        NOT NULL,
  aggregate_id     text        NOT NULL,
  -- NULL for platform-level events that belong to no tenant.
  tenant_id        uuid        NULL,
  payload          jsonb       NOT NULL,
  correlation_id   text        NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  -- NULL means "not yet handed to the queue".
  published_at     timestamptz NULL,
  -- Set while a publisher holds the row, so a crashed publisher's claim can
  -- be reaped instead of blocking the event forever.
  claimed_at       timestamptz NULL,
  attempt_count    integer     NOT NULL DEFAULT 0,
  last_error       text        NULL,
  -- Events that exhausted their attempts stop being retried and are surfaced
  -- for operator intervention rather than deleted.
  dead_lettered_at timestamptz NULL,

  CONSTRAINT outbox_events_attempt_count_non_negative CHECK (attempt_count >= 0),
  CONSTRAINT outbox_events_event_version_positive CHECK (event_version > 0)
);

-- The publisher's hot path: "oldest unpublished, not dead-lettered".
-- Partial index keeps it proportional to the backlog, not the table.
CREATE INDEX outbox_events_pending_idx
  ON outbox_events (occurred_at, id)
  WHERE published_at IS NULL AND dead_lettered_at IS NULL;

-- Supports operator queries such as "what failed for this aggregate".
CREATE INDEX outbox_events_aggregate_idx
  ON outbox_events (aggregate_type, aggregate_id, occurred_at DESC);

-- Supports retention sweeps of successfully published events.
CREATE INDEX outbox_events_published_at_idx
  ON outbox_events (published_at)
  WHERE published_at IS NOT NULL;

COMMENT ON TABLE outbox_events IS
  'Transactional outbox. Delivery semantics are AT-LEAST-ONCE: a publisher may '
  'crash between queue publish and marking published, so consumers must be idempotent.';
