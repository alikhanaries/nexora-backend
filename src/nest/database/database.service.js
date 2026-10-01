import { Inject, Injectable } from '@nestjs/common';
import { NEXORA_DATABASE } from './database.tokens.js';

export @Injectable()
class DatabaseService {
  constructor(@Inject(NEXORA_DATABASE) database) {
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
