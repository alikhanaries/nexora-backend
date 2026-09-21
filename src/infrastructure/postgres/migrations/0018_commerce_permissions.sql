-- Phase 3: Additional permission keys for commerce modules.

INSERT INTO permissions (key, description) VALUES
  ('marketplaces.read', 'View global marketplace definitions'),
  ('marketplaces.manage', 'Create and update global marketplace definitions'),
  ('pricing.read', 'View product prices'),
  ('pricing.create', 'Create product prices'),
  ('pricing.update', 'Update product prices'),
  ('offers.read', 'View channel offers'),
  ('offers.create', 'Create channel offers'),
  ('offers.update', 'Update channel offers'),
  ('inventory.adjust', 'Adjust inventory quantities'),
  ('inventory.reserve', 'Reserve and release inventory')
ON CONFLICT (key) DO NOTHING;
