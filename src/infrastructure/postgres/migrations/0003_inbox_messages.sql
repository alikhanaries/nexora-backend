-- Reason: consumer-side deduplication for the at-least-once delivery the
-- outbox provides. The primary key is the deduplication mechanism: a second
-- delivery of the same event to the same consumer fails to insert, and the
-- handler is skipped.

CREATE TABLE inbox_messages (
  -- Logical consumer name, e.g. `integration-events.logger`. Scoping by
  -- consumer lets several consumers each process the same event once.
  consumer_name text        NOT NULL,
  event_id      uuid        NOT NULL,
  event_type    text        NOT NULL,
  status        text        NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz NULL,
  attempt_count integer     NOT NULL DEFAULT 1,
  last_error    text        NULL,

  PRIMARY KEY (consumer_name, event_id),
  CONSTRAINT inbox_messages_status_valid
    CHECK (status IN ('processing', 'processed', 'failed'))
);

-- Supports retention sweeps: processed rows older than the retention window.
CREATE INDEX inbox_messages_processed_at_idx
  ON inbox_messages (processed_at)
  WHERE status = 'processed';

COMMENT ON TABLE inbox_messages IS
  'Deduplication ledger for inbound integration events. One row per '
  '(consumer, event); the primary key conflict is what makes redelivery safe.';
