import { NotFoundError } from '../../../../shared/errors/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createGetMembership(deps) {
    /** Loads membership by id within tenant or NotFound. */
    async function execute(input) {
        return deps.db.execute(async (tx) => {
            const membership = await deps.memberships.findById(tx, input.membershipId);
            if (membership === null || membership.tenantId !== input.tenantId) {
                throw new NotFoundError('Membership was not found');
            }
            return membership;
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
