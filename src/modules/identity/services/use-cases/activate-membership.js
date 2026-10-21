import { NotFoundError } from '../../../../shared/errors/index.js';
import { activateMembershipEntity } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createActivateMembership(deps) {
    async function execute(input) {
        return deps.db.execute(async (tx) => {
            const membership = await deps.memberships.findById(tx, input.membershipId);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            const activated = activateMembershipEntity(membership);
            await deps.memberships.save(tx, activated);
            return { status: 'ACTIVE' };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
