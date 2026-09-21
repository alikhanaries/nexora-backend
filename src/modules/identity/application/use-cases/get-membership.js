import { NotFoundError } from '../../../../shared/errors/index.js';
export class GetMembershipUseCase {
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
            return membership;
        }, { tenantId: input.tenantId });
    }
}
