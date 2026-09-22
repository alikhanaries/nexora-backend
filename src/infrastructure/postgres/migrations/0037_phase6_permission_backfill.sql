-- Backfill Phase 6 webhook permissions onto existing system roles.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.system_key = 'owner'
  AND p.key IN ('webhooks.read', 'webhooks.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('webhooks.read', 'webhooks.manage')
WHERE r.is_system = true
  AND r.system_key = 'integration'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'webhooks.read'
WHERE r.is_system = true
  AND r.system_key = 'viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;
