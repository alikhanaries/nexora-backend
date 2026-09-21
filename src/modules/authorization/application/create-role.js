import { ConflictError, ValidationError } from '../../../shared/errors/index.js';
export class CreateRole {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        const name = input.name.trim();
        if (name.length === 0) {
            throw new ValidationError('Role name is required');
        }
        if (input.permissionKeys.length === 0) {
            throw new ValidationError('At least one permission is required');
        }
        return this.deps.database.execute(async (tx) => {
            const existing = await this.deps.roles.findByTenantAndName(input.tenantId, name, tx);
            if (existing !== null) {
                throw new ConflictError('A role with this name already exists in the tenant', {
                    name,
                });
            }
            return this.deps.roles.create({
                tenantId: input.tenantId,
                name,
                permissionKeys: input.permissionKeys,
                isSystem: false,
                systemKey: null,
            }, tx);
        }, { tenantId: input.tenantId });
    }
}
