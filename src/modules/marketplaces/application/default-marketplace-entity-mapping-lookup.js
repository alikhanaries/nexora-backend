import { toMarketplaceEntityMappingDto } from './marketplace-entity-mapping-dto.js';

export class DefaultMarketplaceEntityMappingLookup {
    deps;

    /**
     * @param {object} deps
     * @param {import('../infrastructure/postgres-marketplace-entity-mapping-repository.js').PostgresMarketplaceEntityMappingRepository} deps.mappings
     * @param {object} deps.queryable
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     */
    async findByExternalEntity(input) {
        const queryable = input.queryable ?? this.deps.queryable;
        const row = await this.deps.mappings.findByExternalEntity(queryable, input.tenantId, input.channelId, input.marketplaceKey, input.externalEntityType, input.externalEntityId);
        if (row === null) {
            return null;
        }
        const dto = toMarketplaceEntityMappingDto(row);
        return {
            nexoraEntityType: dto.nexoraEntityType,
            nexoraEntityId: dto.nexoraEntityId,
            externalEntityType: dto.externalEntityType,
            externalEntityId: dto.externalEntityId,
        };
    }
}
