import { Inject, Injectable } from '@nestjs/common';
import { WASL_DATABASE } from './database.tokens.js';

@Injectable()
class DatabaseService {
  constructor(@Inject(WASL_DATABASE) database) {
    this.database = database;
  }

  isAvailable() {
    return this.database !== null;
  }

  /** @returns {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase | null} */
  getDatabase() {
    return this.database;
  }

  async healthCheck() {
    if (this.database === null) {
      throw new Error('PostgreSQL is not connected');
    }
    await this.database.healthCheck();
  }

  async close() {
    if (this.database === null) {
      return;
    }
    await this.database.close();
  }
}
export { DatabaseService };
