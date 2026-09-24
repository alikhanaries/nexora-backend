import { DefaultMarketplaceEntityMappingRecorder } from './default-marketplace-entity-mapping-recorder.js';
import { MarketplaceEntityMappingService } from './marketplace-entity-mapping-service.js';
import { PostgresMarketplaceEntityMappingRepository } from '../infrastructure/postgres-marketplace-entity-mapping-repository.js';

export function createMarketplaceEntityMappingRecorder() {
    const mappings = new PostgresMarketplaceEntityMappingRepository();
    const mappingService = new MarketplaceEntityMappingService({ mappings });
    return new DefaultMarketplaceEntityMappingRecorder({ mappingService });
}
