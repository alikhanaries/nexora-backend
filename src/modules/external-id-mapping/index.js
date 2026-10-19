import { AssignExternalIntegerIdMapping } from './services/assign-external-integer-id-mapping.js';
import { BackfillExternalIntegerIdMappings } from './services/backfill-external-integer-id-mappings.js';
import { DefaultExternalIntegerIdMappingCommandService } from './services/external-integer-id-mapping-command-service.js';
import { DefaultExternalIntegerIdMappingQueryService } from './services/external-integer-id-mapping-query-service.js';
import {
    PostgresExternalIdBackfillQueries,
    PostgresExternalIntegerIdMappingRepository,
} from './repositories/index.js';

function resolveModuleLogger(logger) {
    if (logger !== undefined) {
        return logger;
    }
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
 * @param {object} deps.database
 * @param {import('pino').Logger} [deps.logger]
 */
export function createExternalIdMappingModule(deps) {
    const mappings = new PostgresExternalIntegerIdMappingRepository();
    const assignExternalIntegerIdMapping = new AssignExternalIntegerIdMapping(mappings);
    const externalIntegerIdMappingCommandService = new DefaultExternalIntegerIdMappingCommandService({
        assignExternalIntegerIdMapping,
    });
    const externalIntegerIdMappingQueryService = new DefaultExternalIntegerIdMappingQueryService({
        queryable: deps.database,
        database: deps.database,
        mappings,
    });
    const backfillQueries = new PostgresExternalIdBackfillQueries();
    const externalIntegerIdBackfillService = new BackfillExternalIntegerIdMappings({
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
