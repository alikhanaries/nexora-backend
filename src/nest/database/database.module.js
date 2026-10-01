import { Module } from '@nestjs/common';
import { ReadinessService } from '../../app/observability/readiness.js';
import { NEST_READINESS } from '../health/readiness.provider.js';
import { DatabaseService } from './database.service.js';
import { NEXORA_DATABASE, NEXORA_LOGGER, NEXORA_METRICS } from './database.tokens.js';

export { NEXORA_DATABASE, NEXORA_LOGGER, NEXORA_METRICS } from './database.tokens.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null }} infra
 */
export class DatabaseModule {
  static register(infra) {
    return {
      module: DatabaseModule,
      global: true,
      providers: [
        { provide: NEXORA_LOGGER, useValue: infra.logger },
        { provide: NEXORA_METRICS, useValue: infra.metrics },
        { provide: NEXORA_DATABASE, useValue: infra.database },
        DatabaseService,
        {
          provide: NEST_READINESS,
          useFactory: (database) => createNestReadiness(database),
          inject: [NEXORA_DATABASE],
        },
      ],
      exports: [
        NEXORA_LOGGER,
        NEXORA_METRICS,
        NEXORA_DATABASE,
        DatabaseService,
        NEST_READINESS,
      ],
    };
  }
}

/** @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase | null} database */
function createNestReadiness(database) {
  if (database === null) {
    return new ReadinessService([]);
  }
  return new ReadinessService([{ name: 'postgres', check: () => database.healthCheck() }]);
}
