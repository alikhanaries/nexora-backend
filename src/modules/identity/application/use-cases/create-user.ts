import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../../../shared/errors/index.js';
import type { PasswordHasher } from '../../../../shared/auth/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import { validatePassword } from '../../../../shared/security/index.js';
import type { PasswordPolicyConfig } from '../../../../shared/security/index.js';
import { Email, User } from '../../domain/index.js';
import type { PasswordCredentialRepository } from '../ports/password-credential-repository.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface CreateUserInput {
  readonly email: string;
  readonly password: string;
}

export interface CreateUserResult {
  readonly id: string;
  readonly email: string;
  readonly status: User['status'];
}

export interface CreateUserDeps {
  readonly db: TransactionManager;
  readonly users: UserRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly passwordHasher: PasswordHasher;
  readonly passwordPolicy: PasswordPolicyConfig;
}

export class CreateUserUseCase {
  constructor(private readonly deps: CreateUserDeps) {}

  async execute(input: CreateUserInput): Promise<CreateUserResult> {
    validatePassword(input.password, this.deps.passwordPolicy);
    const email = Email.create(input.email);

    return this.deps.db.execute(async (tx) => {
      const existing = await this.deps.users.findByNormalizedEmail(tx, email.normalized);
      if (existing !== null) {
        throw new ConflictError('A user with this email already exists');
      }

      const user = User.createNew(randomUUID(), email);
      const passwordHash = await this.deps.passwordHasher.hash(input.password);

      await this.deps.users.save(tx, user);
      await this.deps.credentials.save(tx, user.id, passwordHash);

      return {
        id: user.id,
        email: user.email.raw,
        status: user.status,
      };
    });
  }
}
