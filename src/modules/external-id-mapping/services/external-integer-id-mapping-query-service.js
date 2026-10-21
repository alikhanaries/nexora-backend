export function createDefaultExternalIntegerIdMappingQueryService(deps) {
    async function withQueryable(tenantId, tx, work) {
        if (tx !== undefined) {
            return work(tx);
        }
        if (deps.database?.withTenant !== undefined) {
            return deps.database.withTenant(tenantId, work);
        }
        return work(deps.queryable);
    }

    return {
        /**
         * @param {string} tenantId
         * @param {string} provider
         * @param {string} resourceType
         * @param {number} externalId
         * @param {object} [tx]
         */
        async findResourceIdByExternalId(tenantId, provider, resourceType, externalId, tx) {
            return withQueryable(tenantId, tx, (queryable) =>
                deps.mappings.findResourceIdByExternalId(
                    queryable,
                    tenantId,
                    provider,
                    resourceType,
                    externalId,
                ));
        },

        /**
         * @param {string} tenantId
         * @param {string} provider
         * @param {string} resourceType
         * @param {string} resourceId
         * @param {object} [tx]
         */
        async findExternalIdByResourceId(tenantId, provider, resourceType, resourceId, tx) {
            return withQueryable(tenantId, tx, (queryable) =>
                deps.mappings.findExternalIdByResourceId(
                    queryable,
                    tenantId,
                    provider,
                    resourceType,
                    resourceId,
                ));
        },

        /**
         * @param {string} tenantId
         * @param {string} provider
         * @param {string} resourceType
         * @param {readonly string[]} resourceIds
         * @param {object} [tx]
         */
        async findExternalIdsByResourceIds(tenantId, provider, resourceType, resourceIds, tx) {
            return withQueryable(tenantId, tx, (queryable) =>
                deps.mappings.findExternalIdsByResourceIds(
                    queryable,
                    tenantId,
                    provider,
                    resourceType,
                    resourceIds,
                ));
        },
    };
}
