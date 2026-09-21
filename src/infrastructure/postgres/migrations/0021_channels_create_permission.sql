-- channels.create was omitted from Phase 2; required for channel creation in Phase 3.

INSERT INTO permissions (key, description) VALUES
  ('channels.create', 'Create tenant sales channels')
ON CONFLICT (key) DO NOTHING;
