import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CloseTenant, CreateTenant, GetTenant, ReactivateTenant, SuspendTenant, } from './application/index.js';
import { PostgresTenantRepository } from './infrastructure/index.js';
import tenantRoutes, {} from './presentation/tenant.routes.js';
export function createTenantsModule(deps) {
    const repository = new PostgresTenantRepository();
    const authorization = deps.authorization ?? new DefaultAuthorizationService();
    const useCases = {
        createTenant: new CreateTenant(repository, deps.transactionManager),
        getTenant: new GetTenant(repository, deps.queryable),
        suspendTenant: new SuspendTenant(repository, deps.transactionManager, authorization),
        reactivateTenant: new ReactivateTenant(repository, deps.transactionManager, authorization),
        closeTenant: new CloseTenant(repository, deps.transactionManager, authorization),
    };
    return {
        useCases,
        routes: tenantRoutes,
    };
}
export { Tenant, TenantStatus } from './domain/index.js';
