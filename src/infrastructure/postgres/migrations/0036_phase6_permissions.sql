-- Phase 6: Webhook subscription permissions.

INSERT INTO permissions (key, description) VALUES
  ('webhooks.read', 'View webhook subscriptions and delivery history'),
  ('webhooks.manage', 'Create and manage webhook subscriptions')
ON CONFLICT (key) DO NOTHING;
