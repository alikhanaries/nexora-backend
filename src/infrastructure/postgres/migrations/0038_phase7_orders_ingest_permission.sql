-- Phase 7.2: Channel order ingestion permission.

INSERT INTO permissions (key, description) VALUES
  ('orders.ingest', 'Ingest channel orders via the Channel API')
ON CONFLICT (key) DO NOTHING;
