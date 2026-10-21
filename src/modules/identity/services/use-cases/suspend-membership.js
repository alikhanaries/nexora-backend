import { NotFoundError } from '../../../../shared/errors/index.js';
import { suspendMembershipEntity } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createSuspendMembership(deps) {
    /** Sets membership SUSPENDED; tenant-scoped lookup. */
    async function execute(input) {
        return deps.db.execute(async (tx) => {
            const membership = await deps.memberships.findById(tx, input.membershipId);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            const suspended = suspendMembershipEntity(membership);
            await deps.memberships.save(tx, suspended);
            return { status: 'SUSPENDED' };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
