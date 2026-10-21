/**
 * Nest dynamic module wiring logger, metrics, Postgres, and readiness probes from boot `infra`.
 */
import { Module } from '@nestjs/common';
import { ReadinessService } from '../observability/readiness.js';
import { NEST_READINESS } from '../../modules/health/controllers/nest/readiness.provider.js';
import { DatabaseService } from './database.service.js';
import { WASL_DATABASE, WASL_LOGGER, WASL_METRICS } from './database.tokens.js';

export { WASL_DATABASE, WASL_LOGGER, WASL_METRICS } from './database.tokens.js';

/**
 * @param {{ logger: object, metrics: object, database: object | null, readiness?: object }} infra
 */
export class DatabaseModule {
  /** Registers global Nest providers for logger, metrics, DB handle, readiness, and {@link DatabaseService}. */
  static register(infra) {
    const readinessProvider =
      infra.readiness !== undefined && infra.readiness !== null
        ? { provide: NEST_READINESS, useValue: infra.readiness }
        : {
            provide: NEST_READINESS,
            useFactory: (database) => createNestReadiness(database),
            inject: [WASL_DATABASE],
          };

    return {
      module: DatabaseModule,
      global: true,
      providers: [
        { provide: WASL_LOGGER, useValue: infra.logger },
        { provide: WASL_METRICS, useValue: infra.metrics },
        { provide: WASL_DATABASE, useValue: infra.database },
        DatabaseService,
        readinessProvider,
      ],
      exports: [
        WASL_LOGGER,
        WASL_METRICS,
        WASL_DATABASE,
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
