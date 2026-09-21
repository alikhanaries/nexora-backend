-- Phase 3: Global marketplace definitions (not tenant-owned).

CREATE TABLE marketplaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT marketplaces_key_normalized CHECK (key = lower(trim(key))),
  CONSTRAINT marketplaces_key_format CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT marketplaces_status_valid CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX marketplaces_key_unique ON marketplaces (key);
CREATE INDEX marketplaces_status_idx ON marketplaces (status);

COMMENT ON TABLE marketplaces IS
  'Global platform marketplace definitions. Not tenant-specific. No credentials stored here.';
