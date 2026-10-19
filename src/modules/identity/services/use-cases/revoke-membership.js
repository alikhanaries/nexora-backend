import { NotFoundError } from '../../../../shared/errors/index.js';
export class RevokeMembershipUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        return this.deps.db.execute(async (tx) => {
            const membership = await this.deps.memberships.findById(tx, input.membershipId);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            const revoked = membership.revoke();
            await this.deps.memberships.save(tx, revoked);
            return { status: 'REVOKED' };
        }, { tenantId: input.tenantId });
    }
}
