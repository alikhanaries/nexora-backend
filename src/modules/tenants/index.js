import { DefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCloseTenant,
    createCreateTenant,
    createGetTenant,
    createReactivateTenant,
    createSuspendTenant,
} from './services/index.js';
import { PostgresTenantRepository } from './repositories/index.js';
import tenantRoutes, {} from './views/tenant.routes.js';

export function createTenantsModule(deps) {
    const repository = new PostgresTenantRepository();
    const authorization = deps.authorization ?? new DefaultAuthorizationService();
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
        routes: tenantRoutes,
    };
}
export { Tenant, TenantStatus } from './models/index.js';
