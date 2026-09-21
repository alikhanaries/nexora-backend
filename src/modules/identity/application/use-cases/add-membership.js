import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import { Membership } from '../../domain/index.js';
export class AddMembershipUseCase {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async execute(input) {
        return this.deps.db.execute(async (tx) => {
            const user = await this.deps.users.findById(tx, input.userId);
            if (user === null) {
                throw new NotFoundError('User was not found');
            }
            const existing = await this.deps.memberships.findByTenantAndUser(tx, input.tenantId, input.userId);
            if (existing !== null) {
                if (existing.isTerminal()) {
                    throw new ConflictError('Membership was revoked and cannot be recreated');
                }
                throw new ConflictError('Membership already exists for this tenant');
            }
            const membership = Membership.createPending(randomUUID(), input.tenantId, input.userId);
            await this.deps.memberships.save(tx, membership);
            return {
                id: membership.id,
                tenantId: membership.tenantId,
                userId: membership.userId,
                status: membership.status,
            };
        }, { tenantId: input.tenantId });
    }
}
