/**
 * Resolves effective permissions as the union of all ACTIVE roles on an ACTIVE
 * membership. Inactive roles and non-active memberships yield no permissions.
 */
export function resolveEffectivePermissions(context) {
    if (context.membershipStatus !== 'ACTIVE') {
        return [];
    }
    const granted = new Set();
    for (const assignment of context.roleAssignments) {
        if (assignment.roleStatus !== 'ACTIVE') {
            continue;
        }
        for (const key of assignment.permissionKeys) {
            granted.add(key);
        }
    }
    return [...granted].sort();
}
