export class DefaultExternalIntegerIdMappingCommandService {
    deps;

    /**
     * @param {object} deps
     * @param {import('./assign-external-integer-id-mapping.js').AssignExternalIntegerIdMapping} deps.assignExternalIntegerIdMapping
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} transaction
     * @param {import('../public/external-integer-id-mapping-command-service.js').AssignExternalIntegerIdMappingCommand} command
     * @returns {Promise<import('../public/external-integer-id-mapping-command-service.js').AssignExternalIntegerIdMappingResult>}
     */
    async assignMapping(transaction, command) {
        const mapping = await this.deps.assignExternalIntegerIdMapping.execute({
            transaction,
            mapping: {
                tenantId: command.tenantId,
                provider: command.provider,
                resourceType: command.resourceType,
                resourceId: command.resourceId,
            },
        });
        return { mapping };
    }
}
