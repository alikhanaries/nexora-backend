export class ListRoles {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return this.deps.database.execute(async (tx) => {
            const roles = await this.deps.roles.listByTenant(input.tenantId, tx);
            const withPermissions = [];
            for (const role of roles) {
                const permissions = await this.deps.roles.listPermissionsForRole(role.id, tx);
                withPermissions.push({
                    ...role,
                    permissionKeys: permissions.map((permission) => permission.key),
                });
            }
            return withPermissions;
        }, { tenantId: input.tenantId });
    }
}
