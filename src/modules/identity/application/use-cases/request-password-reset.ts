import { randomUUID } from 'node:crypto';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { generateSecureToken, hashSecret } from '../../../../shared/security/index.js';
import { Email } from '../../domain/index.js';
import type { PasswordResetNotifier } from '../ports/password-reset-notifier.js';
import type { PasswordResetTokenRepository } from '../ports/password-reset-token-repository.js';
import type { UserRepository } from '../ports/user-repository.js';

const RESET_TOKEN_TTL_SECONDS = 3_600;

export interface RequestPasswordResetInput {
  readonly email: string;
}

export interface RequestPasswordResetDeps {
  readonly db: TransactionManager;
  readonly users: UserRepository;
  readonly resetTokens: PasswordResetTokenRepository;
  readonly notifier: PasswordResetNotifier;
}

/** Always completes silently to avoid email enumeration. */
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      return;
    }

    await this.deps.db.execute(async (tx) => {
      const user = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
      if (user === null) {
        return;
      }

      await this.deps.resetTokens.revokeActiveForUser(tx, user.id);

      const resetToken = generateSecureToken(32);
      const tokenHash = hashSecret(resetToken);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_SECONDS * 1_000);

      await this.deps.resetTokens.save(tx, {
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        status: 'ACTIVE',
        expiresAt,
        createdAt: now,
        usedAt: null,
      });

      await this.deps.notifier.notifyPasswordReset({
        userId: user.id,
        email: user.email.raw,
        resetToken,
      });
    });
  }
}
