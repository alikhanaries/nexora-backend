import { NotFoundError, ValidationError } from '../../../shared/errors/index.js';
export class RemoveRole {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        await this.deps.database.execute(async (tx) => {
            const membership = await this.deps.membershipRoles.findMembership(input.membershipId, tx);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            if (membership.status !== 'ACTIVE') {
                throw new ValidationError('Roles can only be removed from active memberships');
            }
            const role = await this.deps.roles.findById(input.roleId, tx);
            if (role === null || role.tenantId !== input.tenantId) {
                throw new NotFoundError('Role was not found');
            }
            const assigned = await this.deps.membershipRoles.listRolesForMembership(input.membershipId, tx);
            if (!assigned.some((entry) => entry.id === input.roleId)) {
                throw new NotFoundError('Role is not assigned to this membership');
            }
            await this.deps.lastAdminGuard.assertCanRemoveRole(input.tenantId, input.membershipId, input.roleId, tx);
            await this.deps.membershipRoles.removeRole(input.membershipId, input.roleId, tx);
        }, { tenantId: input.tenantId });
    }
}
