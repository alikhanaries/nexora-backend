import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/index.js';
export class AssignRole {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        this.deps.authorization.requirePermission(input.actorPermissions, 'roles.manage');
        return this.deps.database.execute(async (tx) => {
            const membership = await this.deps.membershipRoles.findMembership(input.membershipId, tx);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            if (membership.status !== 'ACTIVE') {
                throw new ValidationError('Roles can only be assigned to active memberships');
            }
            const role = await this.deps.roles.findById(input.roleId, tx);
            if (role === null || role.tenantId !== input.tenantId) {
                throw new NotFoundError('Role was not found');
            }
            if (role.status !== 'ACTIVE') {
                throw new ValidationError('Inactive roles cannot be assigned');
            }
            const assigned = await this.deps.membershipRoles.listRolesForMembership(input.membershipId, tx);
            if (assigned.some((entry) => entry.id === input.roleId)) {
                throw new ConflictError('Role is already assigned to this membership');
            }
            await this.deps.membershipRoles.assignRole(input.membershipId, input.roleId, tx);
            const permissions = await this.deps.roles.listPermissionsForRole(role.id, tx);
            return {
                ...role,
                permissionKeys: permissions.map((permission) => permission.key),
            };
        }, { tenantId: input.tenantId });
    }
}
