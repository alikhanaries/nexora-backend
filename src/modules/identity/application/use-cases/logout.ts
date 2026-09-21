import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { hashSecret } from '../../../../shared/security/index.js';
import { InvalidCredentialsError } from '../../domain/index.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';

export interface LogoutInput {
  readonly refreshToken: string;
}

export interface LogoutDeps {
  readonly db: TransactionManager;
  readonly refreshSessions: RefreshSessionRepository;
}

export class LogoutUseCase {
  constructor(private readonly deps: LogoutDeps) {}

  async execute(input: LogoutInput): Promise<void> {
    const tokenHash = hashSecret(input.refreshToken);
    const now = new Date();

    await this.deps.db.execute(async (tx) => {
      const session = await this.deps.refreshSessions.findByTokenHash(tx, tokenHash);
      if (session === null || session.status !== 'ACTIVE') {
        throw new InvalidCredentialsError();
      }

      await this.deps.refreshSessions.revokeById(tx, session.id, now);
    });
  }
}
