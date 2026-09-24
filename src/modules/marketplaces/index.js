import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateMarketplace, CreateMarketplace, DeactivateMarketplace, GetMarketplace, ListMarketplaces, UpdateMarketplace, VerifyMarketplaceExists, } from './application/index.js';
import { PostgresMarketplaceRepository } from './infrastructure/index.js';
import marketplaceRoutes, {} from './presentation/marketplace.routes.js';
export { createMarketplaceConnectionServices } from './application/create-marketplace-connection-services.js';
export { createMarketplaceEntityMappingRecorder } from './application/create-marketplace-entity-mapping-recorder.js';
export function createMarketplacesModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const repository = new PostgresMarketplaceRepository();
    const sharedDeps = {
        authorization,
        repository,
        database: deps.database,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const useCases = {
        createMarketplace: new CreateMarketplace(sharedDeps),
        getMarketplace: new GetMarketplace({
            authorization,
            repository,
            queryable: deps.database,
        }),
        listMarketplaces: new ListMarketplaces({
            authorization,
            repository,
            queryable: deps.database,
        }),
        updateMarketplace: new UpdateMarketplace(sharedDeps),
        activateMarketplace: new ActivateMarketplace(sharedDeps),
        deactivateMarketplace: new DeactivateMarketplace(sharedDeps),
    };
    const verifyMarketplaceExists = new VerifyMarketplaceExists({
        repository,
        queryable: deps.database,
    });
    return {
        useCases,
        verifyMarketplaceExists,
        routes: marketplaceRoutes,
    };
}
export { Marketplace, MarketplaceStatus } from './domain/index.js';
