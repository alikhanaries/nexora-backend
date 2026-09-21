import { CloseTenant, CreateTenant, GetTenant, ReactivateTenant, SuspendTenant, } from './application/index.js';
import { PostgresTenantRepository } from './infrastructure/index.js';
import tenantRoutes, {} from './presentation/tenant.routes.js';
export function createTenantsModule(deps) {
    const repository = new PostgresTenantRepository();
    const useCases = {
        createTenant: new CreateTenant(repository, deps.transactionManager),
        getTenant: new GetTenant(repository, deps.queryable),
        suspendTenant: new SuspendTenant(repository, deps.transactionManager),
        reactivateTenant: new ReactivateTenant(repository, deps.transactionManager),
        closeTenant: new CloseTenant(repository, deps.transactionManager),
    };
    return {
        useCases,
        routes: tenantRoutes,
    };
}
export { Tenant, TenantStatus } from './domain/index.js';
