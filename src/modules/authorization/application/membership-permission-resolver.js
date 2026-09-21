import { resolveEffectivePermissions } from '../domain/effective-permissions.js';
export class AuthorizationMembershipPermissionResolver {
    membershipRoles;
    constructor(membershipRoles) {
        this.membershipRoles = membershipRoles;
    }
    async resolvePermissions(tx, input) {
        const context = await this.membershipRoles.loadPermissionContextByUserAndTenant(input.userId, input.tenantId, tx);
        if (context === null) {
            return [];
        }
        return resolveEffectivePermissions(context);
    }
}
