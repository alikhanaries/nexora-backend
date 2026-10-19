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
    requireTenantsModuleDeps(deps);
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

/**
 * Fail at wiring time when required collaborators are missing rather than on
 * the first tenant request with a cryptic property-access TypeError.
 *
 * @param {object} deps
 */
function requireTenantsModuleDeps(deps) {
    if (deps === undefined || deps === null || typeof deps !== 'object') {
        throw new Error('createTenantsModule requires a deps object');
    }
    for (const name of ['transactionManager', 'queryable']) {
        if (deps[name] === undefined || deps[name] === null) {
            throw new Error(`createTenantsModule requires deps.${name}`);
        }
    }
}
