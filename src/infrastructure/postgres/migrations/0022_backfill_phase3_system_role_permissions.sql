-- Backfill Phase 3 permission keys onto existing system roles.
--
-- SystemRoleSeeder assigns permissions only when a system role is first created.
-- Tenants provisioned before migrations 0018/0021 keep stale role_permissions rows
-- until this backfill runs.

-- Owner: all permissions in the catalog (mirrors { kind: 'all' }).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.system_key = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Integration: channels.* prefix.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key LIKE 'channels.%'
WHERE r.is_system = true
  AND r.system_key = 'integration'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer: *.read suffix.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key LIKE '%.read'
WHERE r.is_system = true
  AND r.system_key = 'viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations Manager: orders.*, products.*, inventory.*, shipments.*, returns.*
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  p.key LIKE 'orders.%'
  OR p.key LIKE 'products.%'
  OR p.key LIKE 'inventory.%'
  OR p.key LIKE 'shipments.%'
  OR p.key LIKE 'returns.%'
)
WHERE r.is_system = true
  AND r.system_key = 'operations_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Fulfillment Operator: orders.read, inventory.*, shipments.*
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  p.key = 'orders.read'
  OR p.key LIKE 'inventory.%'
  OR p.key LIKE 'shipments.%'
)
WHERE r.is_system = true
  AND r.system_key = 'fulfillment_operator'
ON CONFLICT (role_id, permission_id) DO NOTHING;
