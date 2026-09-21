import { NotFoundError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';

export interface SuspendMembershipInput {
  readonly tenantId: string;
  readonly membershipId: string;
}

export interface SuspendMembershipDeps {
  readonly db: TransactionManager;
  readonly memberships: MembershipRepository;
}

export class SuspendMembershipUseCase {
  constructor(private readonly deps: SuspendMembershipDeps) {}

  async execute(input: SuspendMembershipInput): Promise<{ status: 'SUSPENDED' }> {
    return this.deps.db.execute(
      async (tx) => {
        const membership = await this.deps.memberships.findById(tx, input.membershipId);
        if (membership === null || membership.tenantId !== input.tenantId) {
          throw new NotFoundError('Membership was not found');
        }

        const suspended = membership.suspend();
        await this.deps.memberships.save(tx, suspended);
        return { status: 'SUSPENDED' as const };
      },
      { tenantId: input.tenantId },
    );
  }
}
