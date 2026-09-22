-- Backfill Phase 7.2 orders.ingest permission onto integration roles.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.system_key = 'owner'
  AND p.key = 'orders.ingest'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'orders.ingest'
WHERE r.is_system = true
  AND r.system_key = 'integration'
ON CONFLICT (role_id, permission_id) DO NOTHING;
