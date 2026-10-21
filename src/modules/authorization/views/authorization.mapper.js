/**
 * @param {object} role
 */
export function toRoleResponse(role) {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    systemKey: role.systemKey,
    status: role.status,
    isSystem: role.isSystem,
    permissionKeys: [...role.permissionKeys],
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

/**
 * @param {object} permission
 */
export function toPermissionResponse(permission) {
  return {
    id: permission.id,
    key: permission.key,
    description: permission.description,
    createdAt: permission.createdAt.toISOString(),
  };
}
