/**
 * Commerce integrations (sales channels): CRUD, lifecycle (activate/deactivate/suspend), and query service.
 * Re-exports integration entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createActivateCommerceIntegration,
    createCreateCommerceIntegration,
    createDeactivateCommerceIntegration,
    createDefaultCommerceIntegrationQueryService,
    createGetCommerceIntegration,
    createListCommerceIntegrations,
    createSuspendCommerceIntegration,
    createUpdateCommerceIntegration,
} from './services/index.js';
import { createPostgresCommerceIntegrationRepository } from './repositories/index.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {{ execute: Function }} deps.verifyMarketplaceExists
 * @param {import('../inventory/public/index.js').DefaultInventoryService} deps.inventoryService
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ useCases: object, commerceIntegrationQueryService: object }}
 */
export function createCommerceIntegrationsModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const repository = createPostgresCommerceIntegrationRepository();
    const sharedDeps = {
        authorization,
        repository,
        database: deps.database,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
    };
    const commerceIntegrationQueryService = createDefaultCommerceIntegrationQueryService({
        database: deps.database,
        repository,
    });
    const useCases = {
        createCommerceIntegration: createCreateCommerceIntegration({
            ...sharedDeps,
            verifyMarketplaceExists: deps.verifyMarketplaceExists,
            inventoryService: deps.inventoryService,
        }),
        updateCommerceIntegration: createUpdateCommerceIntegration({
            ...sharedDeps,
            inventoryService: deps.inventoryService,
        }),
        getCommerceIntegration: createGetCommerceIntegration(sharedDeps),
        listCommerceIntegrations: createListCommerceIntegrations(sharedDeps),
        activateCommerceIntegration: createActivateCommerceIntegration(sharedDeps),
        deactivateCommerceIntegration: createDeactivateCommerceIntegration(sharedDeps),
        suspendCommerceIntegration: createSuspendCommerceIntegration(sharedDeps),
    };
    return {
        useCases,
        commerceIntegrationQueryService,
    };
}

export {
    createCommerceIntegrationEntity,
    reconstituteCommerceIntegration,
    isCommerceIntegrationUsable,
    updateCommerceIntegrationDetails,
    activateCommerceIntegration,
    deactivateCommerceIntegration,
    suspendCommerceIntegration,
    IntegrationStatus,
} from './models/index.js';
