import type { PasswordHasher } from '../../../../shared/auth/index.js';
import { InvalidCredentialsError } from '../../domain/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { hashSecret, validatePassword } from '../../../../shared/security/index.js';
import type { PasswordPolicyConfig } from '../../../../shared/security/index.js';
import type { PasswordCredentialRepository } from '../ports/password-credential-repository.js';
import type { PasswordResetTokenRepository } from '../ports/password-reset-token-repository.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';

export interface ConfirmPasswordResetInput {
  readonly token: string;
  readonly newPassword: string;
}

export interface ConfirmPasswordResetDeps {
  readonly db: TransactionManager;
  readonly resetTokens: PasswordResetTokenRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly refreshSessions: RefreshSessionRepository;
  readonly passwordHasher: PasswordHasher;
  readonly passwordPolicy: PasswordPolicyConfig;
}

export class ConfirmPasswordResetUseCase {
  constructor(private readonly deps: ConfirmPasswordResetDeps) {}

  async execute(input: ConfirmPasswordResetInput): Promise<void> {
    validatePassword(input.newPassword, this.deps.passwordPolicy);
    const tokenHash = hashSecret(input.token);
    const now = new Date();

    await this.deps.db.execute(async (tx) => {
      const token = await this.deps.resetTokens.findActiveByTokenHash(tx, tokenHash);
      if (token === null || token.expiresAt <= now) {
        throw new InvalidCredentialsError();
      }

      const passwordHash = await this.deps.passwordHasher.hash(input.newPassword);
      await this.deps.credentials.save(tx, token.userId, passwordHash);
      await this.deps.resetTokens.markUsed(tx, token.id, now);
      await this.deps.refreshSessions.revokeAllForUser(tx, token.userId, now);
    });
  }
}
