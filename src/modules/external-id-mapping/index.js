/**
 * External integer ID mappings: assigns legacy/external IDs to internal entities, query/command services, and backfill jobs.
 */
import { createAssignExternalIntegerIdMapping } from './services/assign-external-integer-id-mapping.js';
import { createBackfillExternalIntegerIdMappings } from './services/backfill-external-integer-id-mappings.js';
import { createDefaultExternalIntegerIdMappingCommandService } from './services/external-integer-id-mapping-command-service.js';
import { createDefaultExternalIntegerIdMappingQueryService } from './services/external-integer-id-mapping-query-service.js';
import {
    createPostgresExternalIdBackfillQueries,
    createPostgresExternalIntegerIdMappingRepository,
} from './repositories/index.js';

/** Uses injected pino logger or a no-op logger for CLI/backfill without observability wiring. */
function resolveModuleLogger(logger) {
    if (logger !== undefined) {
        return logger;
    }
    /** No-op log method for silent fallback logger. */
    const silent = () => undefined;
    return {
        info: silent,
        warn: silent,
        error: silent,
        debug: silent,
        child: () => resolveModuleLogger(undefined),
    };
}

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('pino').Logger} [deps.logger]
 * @returns {{ externalIntegerIdMappingCommandService: object, externalIntegerIdMappingQueryService: object, externalIntegerIdBackfillService: object }}
 */
export function createExternalIdMappingModule(deps) {
    const mappings = createPostgresExternalIntegerIdMappingRepository();
    const assignExternalIntegerIdMapping = createAssignExternalIntegerIdMapping(mappings);
    const externalIntegerIdMappingCommandService = createDefaultExternalIntegerIdMappingCommandService({
        assignExternalIntegerIdMapping,
    });
    const externalIntegerIdMappingQueryService = createDefaultExternalIntegerIdMappingQueryService({
        queryable: deps.database,
        database: deps.database,
        mappings,
    });
    const backfillQueries = createPostgresExternalIdBackfillQueries();
    const externalIntegerIdBackfillService = createBackfillExternalIntegerIdMappings({
        database: deps.database,
        externalIntegerIdMappingCommandService,
        backfillQueries,
        logger: resolveModuleLogger(deps.logger).child({ component: 'external-id-backfill' }),
    });
    return {
        externalIntegerIdMappingCommandService,
        externalIntegerIdMappingQueryService,
        externalIntegerIdBackfillService,
    };
}
