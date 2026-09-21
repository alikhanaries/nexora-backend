import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  ActivateMarketplace,
  CreateMarketplace,
  DeactivateMarketplace,
  GetMarketplace,
  ListMarketplaces,
  UpdateMarketplace,
  VerifyMarketplaceExists,
} from './application/index.js';
import { PostgresMarketplaceRepository } from './infrastructure/index.js';
import marketplaceRoutes, {
  type MarketplaceRoutesDependencies,
} from './presentation/marketplace.routes.js';

export interface MarketplacesModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface MarketplacesModule {
  readonly useCases: MarketplaceRoutesDependencies;
  readonly verifyMarketplaceExists: VerifyMarketplaceExists;
  readonly routes: typeof marketplaceRoutes;
}

export function createMarketplacesModule(deps: MarketplacesModuleDependencies): MarketplacesModule {
  const authorization = new DefaultAuthorizationService();
  const repository = new PostgresMarketplaceRepository();

  const sharedDeps = {
    authorization,
    repository,
    database: deps.database,
    eventRecorder: deps.eventRecorder,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  };

  const useCases: MarketplaceRoutesDependencies = {
    createMarketplace: new CreateMarketplace(sharedDeps),
    getMarketplace: new GetMarketplace({
      authorization,
      repository,
      queryable: deps.database,
    }),
    listMarketplaces: new ListMarketplaces({
      authorization,
      repository,
      queryable: deps.database,
    }),
    updateMarketplace: new UpdateMarketplace(sharedDeps),
    activateMarketplace: new ActivateMarketplace(sharedDeps),
    deactivateMarketplace: new DeactivateMarketplace(sharedDeps),
  };

  const verifyMarketplaceExists = new VerifyMarketplaceExists({
    repository,
    queryable: deps.database,
  });

  return {
    useCases,
    verifyMarketplaceExists,
    routes: marketplaceRoutes,
  };
}

export { Marketplace, MarketplaceStatus } from './domain/index.js';
