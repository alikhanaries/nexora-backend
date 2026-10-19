import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateCommerceIntegration, CreateCommerceIntegration, DeactivateCommerceIntegration, CommerceIntegrationQueryService, GetCommerceIntegration, ListCommerceIntegrations, SuspendCommerceIntegration, UpdateCommerceIntegration, } from './application/index.js';
import { PostgresCommerceIntegrationRepository } from './infrastructure/index.js';
import commerceIntegrationRoutes from './presentation/commerce-integration.routes.js';
export function createCommerceIntegrationsModule(deps) {
    const authorization = new DefaultAuthorizationService();
    const repository = new PostgresCommerceIntegrationRepository();
    const sharedDeps = {
        authorization,
        repository,
        database: deps.database,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const commerceIntegrationQueryService = new CommerceIntegrationQueryService({
        queryable: deps.database,
        database: deps.database,
        getCommerceIntegrationById: (tenantId, channelId, queryable) => repository.findById(queryable, tenantId, channelId),
        getCommerceIntegrationByExternalReference: (tenantId, externalReference, queryable) => repository.findByExternalReference(queryable, tenantId, externalReference),
        listCommerceIntegrations: (tenantId, filters, queryable) => repository.list(queryable, tenantId, filters),
    });
    const useCases = {
        createCommerceIntegration: new CreateCommerceIntegration({
            ...sharedDeps,
            verifyMarketplaceExists: deps.verifyMarketplaceExists,
            inventoryService: deps.inventoryService,
        }),
        updateCommerceIntegration: new UpdateCommerceIntegration({
            ...sharedDeps,
            inventoryService: deps.inventoryService,
        }),
        getCommerceIntegration: new GetCommerceIntegration(sharedDeps),
        listCommerceIntegrations: new ListCommerceIntegrations(sharedDeps),
        activateCommerceIntegration: new ActivateCommerceIntegration(sharedDeps),
        deactivateCommerceIntegration: new DeactivateCommerceIntegration(sharedDeps),
        suspendCommerceIntegration: new SuspendCommerceIntegration(sharedDeps),
    };
    return {
        useCases,
        commerceIntegrationQueryService,
        routes: commerceIntegrationRoutes,
    };
}
export { CommerceIntegration, IntegrationStatus } from './domain/index.js';
