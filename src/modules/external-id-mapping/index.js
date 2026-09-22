import { AssignExternalIntegerIdMapping } from './application/assign-external-integer-id-mapping.js';
import { DefaultExternalIntegerIdMappingCommandService } from './application/external-integer-id-mapping-command-service.js';
import { DefaultExternalIntegerIdMappingQueryService } from './application/external-integer-id-mapping-query-service.js';
import { PostgresExternalIntegerIdMappingRepository } from './infrastructure/index.js';

/**
 * @param {object} deps
 * @param {object} deps.database
 */
export function createExternalIdMappingModule(deps) {
    const mappings = new PostgresExternalIntegerIdMappingRepository();
    const assignExternalIntegerIdMapping = new AssignExternalIntegerIdMapping(mappings);
    const externalIntegerIdMappingCommandService = new DefaultExternalIntegerIdMappingCommandService({
        assignExternalIntegerIdMapping,
    });
    const externalIntegerIdMappingQueryService = new DefaultExternalIntegerIdMappingQueryService({
        queryable: deps.database,
        mappings,
    });
    return {
        externalIntegerIdMappingCommandService,
        externalIntegerIdMappingQueryService,
    };
}
