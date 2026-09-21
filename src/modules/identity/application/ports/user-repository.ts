import type { User } from '../../domain/index.js';
import type { Transaction } from '../../../../shared/persistence/index.js';

export interface UserRepository {
  findById(tx: Transaction, id: string): Promise<User | null>;
  findByNormalizedEmail(tx: Transaction, normalizedEmail: string): Promise<User | null>;
  save(tx: Transaction, user: User): Promise<void>;
}
