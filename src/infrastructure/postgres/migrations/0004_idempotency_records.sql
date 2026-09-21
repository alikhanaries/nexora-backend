-- Reason: backs IdempotencyService. Clients retry mutating calls after
-- timeouts; without a durable record the retry creates a second resource.
-- Redis is unsuitable here because an eviction would turn a replay into a
-- duplicate write.

CREATE TABLE idempotency_records (
  tenant_id              uuid        NULL,
  principal_fingerprint  text        NOT NULL,
  route_id               text        NOT NULL,
  idempotency_key        text        NOT NULL,
  request_fingerprint    text        NOT NULL,
  status                 text        NOT NULL,
  response_status        integer     NULL,
  response_body          jsonb       NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz NULL,
  expires_at             timestamptz NOT NULL,

  CONSTRAINT idempotency_records_status_valid
    CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT idempotency_records_completed_has_response
    CHECK (status <> 'completed' OR response_status IS NOT NULL)
);

CREATE UNIQUE INDEX idempotency_records_key_uidx
  ON idempotency_records (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    principal_fingerprint,
    route_id,
    idempotency_key
  );

CREATE INDEX idempotency_records_expires_at_idx
  ON idempotency_records (expires_at);

COMMENT ON TABLE idempotency_records IS
  'Replay ledger for idempotent mutations. Records expire; a client retrying '
  'after expiry is treated as a new request.';
