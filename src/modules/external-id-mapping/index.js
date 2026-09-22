import { AssignExternalIntegerIdMapping } from './application/assign-external-integer-id-mapping.js';
import { PostgresExternalIntegerIdMappingRepository } from './infrastructure/index.js';

/**
 * Phase 8.1 module wiring — repository and internal assign use case only.
 * Public command/query ports are deferred to Phase 8.2.
 */
export function createExternalIdMappingModule() {
    const mappings = new PostgresExternalIntegerIdMappingRepository();
    return {
        mappings,
        assignExternalIntegerIdMapping: new AssignExternalIntegerIdMapping(mappings),
    };
}

export { PostgresExternalIntegerIdMappingRepository } from './infrastructure/index.js';
