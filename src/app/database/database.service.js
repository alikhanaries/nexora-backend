/**
 * Nest injectable wrapper around the shared Postgres client (or null in infra-only boots).
 */
import { Inject, Injectable } from '@nestjs/common';
import { WASL_DATABASE } from './database.tokens.js';

@Injectable()
class DatabaseService {
  /** @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase | null} database */
  constructor(@Inject(WASL_DATABASE) database) {
    this.database = database;
  }

  /** True when a Postgres client was wired at boot (false in infra-only modes). */
  isAvailable() {
    return this.database !== null;
  }

  /** @returns {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase | null} */
  getDatabase() {
    return this.database;
  }

  /** Delegates to the underlying pool health probe; throws if DB is not connected. */
  async healthCheck() {
    if (this.database === null) {
      throw new Error('PostgreSQL is not connected');
    }
    await this.database.healthCheck();
  }

  /** Closes the Postgres pool when present; no-op when database is null. */
  async close() {
    if (this.database === null) {
      return;
    }
    await this.database.close();
  }
}
export { DatabaseService };
