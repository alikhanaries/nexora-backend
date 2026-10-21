/**
 * Internal Phase 8.1 use case — assigns a mapping inside the caller's transaction.
 * Phase 8.2 will expose this through public command/query ports.
 */
export function createAssignExternalIntegerIdMapping(mappings) {
    /**
     * @param {object} input
     * @param {object} input.transaction
     * @param {import('../models/external-integer-id-mapping-repository.port.js').AssignExternalIntegerIdMappingInput} input.mapping
     */
    async function execute(input) {
        return mappings.assignMapping(input.transaction, input.mapping);
    }
    return { execute };
}
