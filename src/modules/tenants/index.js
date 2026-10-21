import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCloseTenant,
    createCreateTenant,
    createGetTenant,
    createReactivateTenant,
    createSuspendTenant,
} from './services/index.js';
import { createPostgresTenantRepository } from './repositories/index.js';

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
