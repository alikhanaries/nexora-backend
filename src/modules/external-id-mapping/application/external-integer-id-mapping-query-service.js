export class DefaultExternalIntegerIdMappingQueryService {
    deps;

    /**
     * @param {object} deps
     * @param {object} deps.queryable
     * @param {import('../infrastructure/postgres-external-integer-id-mapping-repository.js').PostgresExternalIntegerIdMappingRepository} deps.mappings
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {number} externalId
     * @param {object} [tx]
     */
    async findResourceIdByExternalId(tenantId, provider, resourceType, externalId, tx) {
        const queryable = tx ?? this.deps.queryable;
        return this.deps.mappings.findResourceIdByExternalId(
            queryable,
            tenantId,
            provider,
            resourceType,
            externalId,
        );
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {string} resourceId
     * @param {object} [tx]
     */
    async findExternalIdByResourceId(tenantId, provider, resourceType, resourceId, tx) {
        const queryable = tx ?? this.deps.queryable;
        return this.deps.mappings.findExternalIdByResourceId(
            queryable,
            tenantId,
            provider,
            resourceType,
            resourceId,
        );
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {readonly string[]} resourceIds
     * @param {object} [tx]
     */
    async findExternalIdsByResourceIds(tenantId, provider, resourceType, resourceIds, tx) {
        const queryable = tx ?? this.deps.queryable;
        return this.deps.mappings.findExternalIdsByResourceIds(
            queryable,
            tenantId,
            provider,
            resourceType,
            resourceIds,
        );
    }
}
