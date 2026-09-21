import { NotFoundError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';

export interface ActivateMembershipInput {
  readonly tenantId: string;
  readonly membershipId: string;
}

export interface ActivateMembershipDeps {
  readonly db: TransactionManager;
  readonly memberships: MembershipRepository;
}

export class ActivateMembershipUseCase {
  constructor(private readonly deps: ActivateMembershipDeps) {}

  async execute(input: ActivateMembershipInput): Promise<{ status: 'ACTIVE' }> {
    return this.deps.db.execute(
      async (tx) => {
        const membership = await this.deps.memberships.findById(tx, input.membershipId);
        if (membership === null || membership.tenantId !== input.tenantId) {
          throw new NotFoundError('Membership was not found');
        }

        const activated = membership.activate();
        await this.deps.memberships.save(tx, activated);
        return { status: 'ACTIVE' as const };
      },
      { tenantId: input.tenantId },
    );
  }
}
