import { ValidationError } from '../../../shared/errors/index.js';
import { isMarketplaceNexoraEntityType } from '../domain/marketplace-nexora-entity-type.js';
import { toMarketplaceEntityMappingDto } from './marketplace-entity-mapping-dto.js';

export class MarketplaceEntityMappingService {
    deps;

    /**
     * @param {object} deps
     * @param {import('../infrastructure/postgres-marketplace-entity-mapping-repository.js').PostgresMarketplaceEntityMappingRepository} deps.mappings
     */
    constructor(deps) {
        this.deps = deps;
    }

    /**
     * @param {object} input
     * @param {object} input.tx
     */
    async upsertMapping(input) {
        assertMappingInput(input);
        await this.deps.mappings.upsert(input.tx, input);
    }

    /**
     * @param {object} input
     */
    async getByNexoraEntity(input) {
        const row = await this.deps.mappings.findByNexoraEntity(
            input.queryable,
            input.tenantId,
            input.channelId,
            input.marketplaceKey,
            input.nexoraEntityType,
            input.nexoraEntityId,
        );
        if (row === null) {
            return { mapping: null };
        }
        return { mapping: toMarketplaceEntityMappingDto(row) };
    }
}

/**
 * @param {object} input
 */
function assertMappingInput(input) {
    if (!isMarketplaceNexoraEntityType(input.nexoraEntityType)) {
        throw new ValidationError('Invalid Nexora entity type for marketplace mapping');
    }
    if (typeof input.externalEntityType !== 'string' || input.externalEntityType.trim().length === 0) {
        throw new ValidationError('External entity type is required');
    }
    if (typeof input.externalEntityId !== 'string' || input.externalEntityId.trim().length === 0) {
        throw new ValidationError('External entity id is required');
    }
}
