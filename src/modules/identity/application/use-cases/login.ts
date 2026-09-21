import type { AuditRecorder } from '../../../audit/public/index.js';
import type { PasswordHasher } from '../../../../shared/auth/index.js';
import { auditRequestFields } from '../../../audit/public/index.js';
import type { Transaction, TransactionManager } from '../../../../shared/persistence/index.js';
import { Email, InvalidCredentialsError, RefreshSession } from '../../domain/index.js';
import { normalizeTenantSlug, validateTenantSlug } from '../../../../shared/security/index.js';
import { createRefreshSessionDraft } from '../auth-tokens.js';
import type { AccessTokenService } from '../../../../shared/auth/index.js';
import type { MembershipRepository } from '../ports/membership-repository.js';
import type { PasswordCredentialRepository } from '../ports/password-credential-repository.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';
import type { TenantLookup } from '../ports/tenant-lookup.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface LoginInput {
  readonly tenantSlug: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface LoginDeps {
  readonly db: TransactionManager;
  readonly tenants: TenantLookup;
  readonly users: UserRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly memberships: MembershipRepository;
  readonly refreshSessions: RefreshSessionRepository;
  readonly passwordHasher: PasswordHasher;
  readonly accessTokenService: AccessTokenService;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly auditRecorder?: AuditRecorder;
}

export class LoginUseCase {
  constructor(private readonly deps: LoginDeps) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    validateTenantSlug(input.tenantSlug);
    const tenantSlug = normalizeTenantSlug(input.tenantSlug);

    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      await this.recordFailure(undefined);
      throw new InvalidCredentialsError();
    }

    const authContext = await this.deps.db.execute(async (tx) => {
      const tenant = await this.deps.tenants.findBySlug(tx, tenantSlug);
      if (tenant === null || tenant.status !== 'ACTIVE') {
        await this.recordFailure(undefined, tx);
        throw new InvalidCredentialsError();
      }

      const user = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
      if (user === null || !user.canAuthenticate()) {
        throw new InvalidCredentialsError();
      }

      const passwordHash = await this.deps.credentials.findHashByUserId(tx, user.id);
      if (passwordHash === null) {
        throw new InvalidCredentialsError();
      }

      const passwordValid = await this.deps.passwordHasher.verify(input.password, passwordHash);
      if (!passwordValid) {
        throw new InvalidCredentialsError();
      }

      return { tenant, user };
    });

    return this.deps.db.execute(
      async (tx) => {
        const membership = await this.deps.memberships.findByTenantAndUser(
          tx,
          authContext.tenant.id,
          authContext.user.id,
        );
        if (membership === null || !membership.grantsAccess()) {
          throw new InvalidCredentialsError();
        }

        const { refreshToken, session: sessionDraft } = createRefreshSessionDraft(
          { userId: authContext.user.id, tenantId: authContext.tenant.id },
          this.deps.refreshTokenTtlSeconds,
        );

        const session = RefreshSession.create(sessionDraft);
        await this.deps.refreshSessions.save(tx, session);

        const accessToken = await this.deps.accessTokenService.sign({
          sub: authContext.user.id,
          tenantId: authContext.tenant.id,
          sessionId: session.id,
          tokenVersion: 1,
        });

        await this.deps.auditRecorder?.record(tx, {
          tenantId: authContext.tenant.id,
          actorKind: 'user',
          actorId: authContext.user.id,
          eventType: 'LOGIN_SUCCESS',
          resourceType: 'user',
          resourceId: authContext.user.id,
          ...auditRequestFields(),
        });

        return {
          accessToken,
          refreshToken,
          expiresIn: this.deps.accessTokenTtlSeconds,
        };
      },
      { tenantId: authContext.tenant.id },
    );
  }

  private async recordFailure(tenantId: string | undefined, tx?: Transaction): Promise<void> {
    const event = {
      tenantId: tenantId ?? null,
      actorKind: 'system' as const,
      eventType: 'LOGIN_FAILURE' as const,
      ...auditRequestFields(),
    };

    if (tx !== undefined) {
      await this.deps.auditRecorder?.record(tx, event);
      return;
    }

    if (tenantId !== undefined) {
      await this.deps.db.execute(
        async (innerTx) => {
          await this.deps.auditRecorder?.record(innerTx, event);
        },
        { tenantId },
      );
    }
  }
}
