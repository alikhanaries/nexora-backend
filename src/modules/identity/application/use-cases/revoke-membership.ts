import { NotFoundError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';

export interface RevokeMembershipInput {
  readonly tenantId: string;
  readonly membershipId: string;
}

export interface RevokeMembershipDeps {
  readonly db: TransactionManager;
  readonly memberships: MembershipRepository;
}

export class RevokeMembershipUseCase {
  constructor(private readonly deps: RevokeMembershipDeps) {}

  async execute(input: RevokeMembershipInput): Promise<{ status: 'REVOKED' }> {
    return this.deps.db.execute(
      async (tx) => {
        const membership = await this.deps.memberships.findById(tx, input.membershipId);
        if (membership === null || membership.tenantId !== input.tenantId) {
          throw new NotFoundError('Membership was not found');
        }

        const revoked = membership.revoke();
        await this.deps.memberships.save(tx, revoked);
        return { status: 'REVOKED' as const };
      },
      { tenantId: input.tenantId },
    );
  }
}
