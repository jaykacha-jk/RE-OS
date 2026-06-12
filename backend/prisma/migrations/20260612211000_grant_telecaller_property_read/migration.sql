INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.tenant_id IS NULL
  AND r.code = 'telecaller'
  AND p.code = 'properties.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
