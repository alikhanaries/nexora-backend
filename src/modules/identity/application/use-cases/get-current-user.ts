import { AuthenticationError } from '../../../../shared/errors/index.js';
import type { AccessTokenService } from '../../../../shared/auth/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface GetCurrentUserInput {
  readonly accessToken: string;
}

export interface CurrentUserResult {
  readonly id: string;
  readonly email: string;
  readonly status: string;
  readonly tenantId: string;
  readonly membershipStatus: string;
}

export interface GetCurrentUserDeps {
  readonly db: TransactionManager;
  readonly accessTokenService: AccessTokenService;
  readonly users: UserRepository;
  readonly memberships: MembershipRepository;
  readonly refreshSessions: RefreshSessionRepository;
}

export class GetCurrentUserUseCase {
  constructor(private readonly deps: GetCurrentUserDeps) {}

  async execute(input: GetCurrentUserInput): Promise<CurrentUserResult> {
    let payload;
    try {
      payload = await this.deps.accessTokenService.verify(input.accessToken);
    } catch {
      throw new AuthenticationError();
    }

    return this.deps.db.execute(
      async (tx) => {
        const session = await this.deps.refreshSessions.findById(tx, payload.sessionId);
        if (session === null || session.status !== 'ACTIVE' || session.isExpired()) {
          throw new AuthenticationError();
        }

        const user = await this.deps.users.findById(tx, payload.sub);
        if (user === null || !user.canAuthenticate()) {
          throw new AuthenticationError();
        }

        const membership = await this.deps.memberships.findByTenantAndUser(
          tx,
          payload.tenantId,
          user.id,
        );
        if (membership === null || !membership.grantsAccess()) {
          throw new AuthenticationError();
        }

        return {
          id: user.id,
          email: user.email.raw,
          status: user.status,
          tenantId: payload.tenantId,
          membershipStatus: membership.status,
        };
      },
      { tenantId: payload.tenantId },
    );
  }
}
