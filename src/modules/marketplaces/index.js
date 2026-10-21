/**
 * Marketplaces registry: channel definitions and admin use cases; exposes `verifyMarketplaceExists` for integrations.
 * Re-exports connection/mapping factory helpers used during app bootstrap.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateMarketplace, CreateMarketplace, DeactivateMarketplace, GetMarketplace, ListMarketplaces, UpdateMarketplace, VerifyMarketplaceExists } from './services/index.js';
import { PostgresMarketplaceRepository } from './repositories/index.js';
export { createMarketplaceConnectionServices } from './services/create-marketplace-connection-services.js';
export { createMarketplaceEntityMappingRecorder } from './services/create-marketplace-entity-mapping-recorder.js';
/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ useCases: object, verifyMarketplaceExists: import('./services/index.js').VerifyMarketplaceExists }}
 */
export function createMarketplacesModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const repository = new PostgresMarketplaceRepository();
    const sharedDeps = {
        authorization,
        repository,
        database: deps.database,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const useCases = {
        createMarketplace: new CreateMarketplace(sharedDeps),
        getMarketplace: new GetMarketplace({
            authorization,
            repository,
            queryable: deps.database
        }),
        listMarketplaces: new ListMarketplaces({
            authorization,
            repository,
            queryable: deps.database
        }),
        updateMarketplace: new UpdateMarketplace(sharedDeps),
        activateMarketplace: new ActivateMarketplace(sharedDeps),
        deactivateMarketplace: new DeactivateMarketplace(sharedDeps)
    };
    const verifyMarketplaceExists = new VerifyMarketplaceExists({
        repository,
        queryable: deps.database
    });
    return {
        useCases,
        verifyMarketplaceExists
    };
}
export { Marketplace, MarketplaceStatus } from './models/index.js';
