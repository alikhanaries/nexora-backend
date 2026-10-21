import { NotFoundError } from '../../../../shared/errors/index.js';
import { revokeMembershipEntity } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createRevokeMembership(deps) {
    /** Terminal REVOKED membership; tenant-scoped lookup. */
    async function execute(input) {
        return deps.db.execute(async (tx) => {
            const membership = await deps.memberships.findById(tx, input.membershipId);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            const revoked = revokeMembershipEntity(membership);
            await deps.memberships.save(tx, revoked);
            return { status: 'REVOKED' };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
