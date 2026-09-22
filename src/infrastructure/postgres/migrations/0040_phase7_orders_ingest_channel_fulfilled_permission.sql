-- Phase 7.3: Channel-fulfilled order ingestion permission.

INSERT INTO permissions (key, description) VALUES
  ('orders.ingest_channel_fulfilled', 'Ingest channel-fulfilled orders via the Channel API')
ON CONFLICT (key) DO NOTHING;
