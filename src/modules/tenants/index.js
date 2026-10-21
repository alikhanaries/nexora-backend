/**
 * Tenants domain: tenant provisioning and lifecycle (suspend, reactivate, close).
 * Re-exports tenant entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCloseTenant,
    createCreateTenant,
    createGetTenant,
    createReactivateTenant,
    createSuspendTenant,
} from './services/index.js';
import { createPostgresTenantRepository } from './repositories/index.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-transaction-manager.js').PostgresTransactionManager} deps.transactionManager
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.queryable
 * @param {ReturnType<typeof import('../authorization/public/index.js').createDefaultAuthorizationService>} [deps.authorization]
 * @returns {{ useCases: object }}
 */
export function createTenantsModule(deps) {
    const repository = createPostgresTenantRepository();
    const authorization = deps.authorization ?? createDefaultAuthorizationService();
    const useCases = {
        createTenant: createCreateTenant({
            repository,
            transactionManager: deps.transactionManager,
        }),
        getTenant: createGetTenant({
            repository,
            queryable: deps.queryable,
        }),
        suspendTenant: createSuspendTenant({
            repository,
            transactionManager: deps.transactionManager,
            authorization,
        }),
        reactivateTenant: createReactivateTenant({
            repository,
            transactionManager: deps.transactionManager,
            authorization,
        }),
        closeTenant: createCloseTenant({
            repository,
            transactionManager: deps.transactionManager,
            authorization,
        }),
    };
    return {
        useCases,
    };
}

export {
    createTenantEntity,
    reconstituteTenant,
    suspendTenantEntity,
    reactivateTenantEntity,
    closeTenantEntity,
    TenantStatus,
} from './models/index.js';
