-- Backfill Phase 4 permissions onto existing system roles.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.system_key = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  p.key LIKE 'orders.%'
  OR p.key LIKE 'shipments.%'
  OR p.key LIKE 'cancellations.%'
  OR p.key LIKE 'returns.%'
)
WHERE r.is_system = true
  AND r.system_key = 'operations_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  p.key LIKE 'orders.%'
  OR p.key LIKE 'shipments.%'
  OR p.key LIKE 'returns.%'
)
WHERE r.is_system = true
  AND r.system_key = 'fulfillment_operator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key LIKE '%.read'
WHERE r.is_system = true
  AND r.system_key = 'viewer'
  AND p.key IN (
    'shipments.read', 'cancellations.read', 'returns.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
