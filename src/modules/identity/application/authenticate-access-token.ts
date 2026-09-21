import type { AccessTokenService } from '../../../shared/auth/index.js';
import { AuthenticationError } from '../../../shared/errors/index.js';
import type { Principal } from '../../../shared/context/request-context.js';
import type { TransactionManager } from '../../../shared/persistence/index.js';
import type { MembershipPermissionResolver } from '../../../shared/auth/index.js';
import type { RefreshSessionRepository } from './ports/refresh-session-repository.js';
import type { UserRepository } from './ports/user-repository.js';

export interface AuthenticateAccessTokenInput {
  readonly accessToken: string;
  readonly authenticationMethod: 'password' | 'refresh';
}

export interface AuthenticateAccessTokenDeps {
  readonly db: TransactionManager;
  readonly accessTokenService: AccessTokenService;
  readonly refreshSessions: RefreshSessionRepository;
  readonly users: UserRepository;
  readonly membershipPermissions: MembershipPermissionResolver;
}

export class AuthenticateAccessTokenUseCase {
  constructor(private readonly deps: AuthenticateAccessTokenDeps) {}

  async execute(input: AuthenticateAccessTokenInput): Promise<Principal> {
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

        const permissions = await this.deps.membershipPermissions.resolvePermissions(tx, {
          userId: user.id,
          tenantId: payload.tenantId,
        });
        if (permissions.length === 0) {
          throw new AuthenticationError();
        }

        return {
          kind: 'user' as const,
          id: user.id,
          tenantId: payload.tenantId,
          permissions,
          authenticationMethod: input.authenticationMethod,
          sessionId: payload.sessionId,
          email: user.email.raw,
        };
      },
      { tenantId: payload.tenantId },
    );
  }
}
