import { NotFoundError } from '../../../../shared/errors/index.js';
export class SuspendMembershipUseCase {
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
            const suspended = membership.suspend();
            await this.deps.memberships.save(tx, suspended);
            return { status: 'SUSPENDED' };
        }, { tenantId: input.tenantId });
    }
}
