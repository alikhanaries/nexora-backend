import type { Transaction } from '../../../../shared/persistence/index.js';

export interface PasswordCredentialRepository {
  findHashByUserId(tx: Transaction, userId: string): Promise<string | null>;
  save(tx: Transaction, userId: string, passwordHash: string): Promise<void>;
}
