import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  CloseTenant,
  CreateTenant,
  GetTenant,
  ReactivateTenant,
  SuspendTenant,
} from './application/index.js';
import { PostgresTenantRepository } from './infrastructure/index.js';
import tenantRoutes, { type TenantRoutesDependencies } from './presentation/tenant.routes.js';

export interface TenantsModuleDependencies {
  readonly queryable: Queryable;
  readonly transactionManager: TransactionManager;
}

export interface TenantsModule {
  readonly useCases: TenantRoutesDependencies;
  readonly routes: typeof tenantRoutes;
}

export function createTenantsModule(deps: TenantsModuleDependencies): TenantsModule {
  const repository = new PostgresTenantRepository();

  const useCases: TenantRoutesDependencies = {
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
