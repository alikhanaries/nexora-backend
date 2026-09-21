import { NotFoundError } from '../../../../shared/errors/index.js';
import type { TransactionManager } from '../../../../shared/persistence/index.js';
import type { User } from '../../domain/index.js';
import type { UserRepository } from '../ports/user-repository.js';

export interface GetUserDeps {
  readonly db: TransactionManager;
  readonly users: UserRepository;
}

export class GetUserUseCase {
  constructor(private readonly deps: GetUserDeps) {}

  async execute(userId: string): Promise<User> {
    return this.deps.db.execute(async (tx) => {
      const user = await this.deps.users.findById(tx, userId);
      if (user === null) {
        throw new NotFoundError('User was not found');
      }
      return user;
    });
  }
}
