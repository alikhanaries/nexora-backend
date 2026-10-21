import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import { createPendingMembershipEntity, isTerminalMembership } from '../../models/index.js';

/**
 * @param {object} deps
 * @returns {{ execute: Function }}
 */
export function createAddMembership(deps) {
    async function execute(input) {
        return deps.db.execute(async (tx) => {
            const user = await deps.users.findById(tx, input.userId);
            if (user === null) {
                throw new NotFoundError('User was not found');
            }
            const existing = await deps.memberships.findByTenantAndUser(tx, input.tenantId, input.userId);
            if (existing !== null) {
                if (isTerminalMembership(existing)) {
                    throw new ConflictError('Membership was revoked and cannot be recreated');
                }
                throw new ConflictError('Membership already exists for this tenant');
            }
            const membership = createPendingMembershipEntity(randomUUID(), input.tenantId, input.userId);
            await deps.memberships.save(tx, membership);
            return {
                id: membership.id,
                tenantId: membership.tenantId,
                userId: membership.userId,
                status: membership.status,
            };
        }, { tenantId: input.tenantId });
    }

    return { execute };
}
