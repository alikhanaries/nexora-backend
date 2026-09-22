/**
 * Internal Phase 8.1 use case — assigns a mapping inside the caller's transaction.
 * Phase 8.2 will expose this through public command/query ports.
 */
export class AssignExternalIntegerIdMapping {
    /** @type {import('../infrastructure/postgres-external-integer-id-mapping-repository.js').PostgresExternalIntegerIdMappingRepository} */
    deps;

    /**
     * @param {import('../infrastructure/postgres-external-integer-id-mapping-repository.js').PostgresExternalIntegerIdMappingRepository} mappings
     */
    constructor(mappings) {
        this.deps = mappings;
    }

    /**
     * @param {object} input
     * @param {object} input.transaction
     * @param {import('../domain/external-integer-id-mapping-repository.port.js').AssignExternalIntegerIdMappingInput} input.mapping
     */
    async execute(input) {
        return this.deps.assignMapping(input.transaction, input.mapping);
    }
}
