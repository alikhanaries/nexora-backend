import { ValidationError } from '../../../shared/errors/index.js';
import { isMarketplaceIntegrationEntityType } from '../domain/marketplace-integration-entity-type.js';
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
    async getByWaslEntity(input) {
        const row = await this.deps.mappings.findByWaslEntity(
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
    if (!isMarketplaceIntegrationEntityType(input.nexoraEntityType)) {
        throw new ValidationError('Invalid commerce entity type for marketplace mapping');
    }
    if (typeof input.externalEntityType !== 'string' || input.externalEntityType.trim().length === 0) {
        throw new ValidationError('External entity type is required');
    }
    if (typeof input.externalEntityId !== 'string' || input.externalEntityId.trim().length === 0) {
        throw new ValidationError('External entity id is required');
    }
}
