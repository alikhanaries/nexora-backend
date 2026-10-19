import { NotFoundError } from '../../../shared/errors/index.js';
export class GetEffectivePermissions {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.read');
        return this.deps.database.execute(async (tx) => {
            const context = await this.deps.membershipRoles.loadPermissionContext(input.membershipId, tx);
            if (context === null) {
                throw new NotFoundError('Membership was not found');
            }
            const permissions = this.deps.authorization.resolveFromContext(context);
            return {
                membershipId: input.membershipId,
                permissions,
            };
        }, { tenantId: input.tenantId });
    }
}
