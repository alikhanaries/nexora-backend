import { NotFoundError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { Membership } from '../../domain/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';

export interface GetMembershipInput {
  readonly tenantId: string;
  readonly membershipId: string;
}

export interface GetMembershipDeps {
  readonly db: TransactionManager;
  readonly memberships: MembershipRepository;
}

export class GetMembershipUseCase {
  constructor(private readonly deps: GetMembershipDeps) {}

  async execute(input: GetMembershipInput): Promise<Membership> {
    return this.deps.db.execute(
      async (tx) => {
        const membership = await this.deps.memberships.findById(tx, input.membershipId);
        if (membership === null || membership.tenantId !== input.tenantId) {
          throw new NotFoundError('Membership was not found');
        }
        return membership;
      },
      { tenantId: input.tenantId },
    );
  }
}
