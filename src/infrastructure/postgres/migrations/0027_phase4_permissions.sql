-- Phase 4: Fulfillment permission keys (orders.* already seeded in 0007).

INSERT INTO permissions (key, description) VALUES
  ('shipments.read', 'View shipments'),
  ('shipments.create', 'Create shipments'),
  ('shipments.update', 'Update shipment status'),
  ('cancellations.read', 'View cancellations'),
  ('cancellations.create', 'Create cancellations'),
  ('returns.read', 'View returns'),
  ('returns.create', 'Create returns'),
  ('returns.update', 'Update return status')
ON CONFLICT (key) DO NOTHING;
