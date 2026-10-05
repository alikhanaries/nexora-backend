export class DefaultExternalIntegerIdMappingQueryService {
    deps;

    /**
     * @param {object} deps
     * @param {object} deps.queryable
     * @param {object} [deps.database]
     * @param {import('../infrastructure/postgres-external-integer-id-mapping-repository.js').PostgresExternalIntegerIdMappingRepository} deps.mappings
     */
    constructor(deps) {
        this.deps = deps;
    }

    async #withQueryable(tenantId, tx, work) {
        if (tx !== undefined) {
            return work(tx);
        }
        if (this.deps.database?.withTenant !== undefined) {
            return this.deps.database.withTenant(tenantId, work);
        }
        return work(this.deps.queryable);
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {number} externalId
     * @param {object} [tx]
     */
    async findResourceIdByExternalId(tenantId, provider, resourceType, externalId, tx) {
        return this.#withQueryable(tenantId, tx, (queryable) =>
            this.deps.mappings.findResourceIdByExternalId(
                queryable,
                tenantId,
                provider,
                resourceType,
                externalId,
            ));
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {string} resourceId
     * @param {object} [tx]
     */
    async findExternalIdByResourceId(tenantId, provider, resourceType, resourceId, tx) {
        return this.#withQueryable(tenantId, tx, (queryable) =>
            this.deps.mappings.findExternalIdByResourceId(
                queryable,
                tenantId,
                provider,
                resourceType,
                resourceId,
            ));
    }

    /**
     * @param {string} tenantId
     * @param {string} provider
     * @param {string} resourceType
     * @param {readonly string[]} resourceIds
     * @param {object} [tx]
     */
    async findExternalIdsByResourceIds(tenantId, provider, resourceType, resourceIds, tx) {
        return this.#withQueryable(tenantId, tx, (queryable) =>
            this.deps.mappings.findExternalIdsByResourceIds(
                queryable,
                tenantId,
                provider,
                resourceType,
                resourceIds,
            ));
    }
}
