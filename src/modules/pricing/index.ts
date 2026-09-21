import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { ChannelQueryService } from '../channels/public/index.js';
import type { ProductQueryService } from '../products/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  CreatePrice,
  DeactivatePrice,
  DefaultPricingService,
  GetPrice,
  ListPrices,
  UpdatePrice,
} from './application/index.js';
import { PostgresPriceRepository } from './infrastructure/index.js';
import priceRoutes, { type PriceRoutesDependencies } from './presentation/price.routes.js';
import type { PricingService } from './public/index.js';

export interface PricingModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly productQueryService: ProductQueryService;
  readonly channelQueryService: ChannelQueryService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface PricingModule {
  readonly pricingService: PricingService;
  readonly useCases: PriceRoutesDependencies;
  readonly routes: typeof priceRoutes;
}

export function createPricingModule(deps: PricingModuleDependencies): PricingModule {
  const authorization = new DefaultAuthorizationService();
  const prices = new PostgresPriceRepository();

  const pricingService = new DefaultPricingService({
    transactionManager: deps.database,
    queryable: deps.database,
    prices,
    productQueryService: deps.productQueryService,
    channelQueryService: deps.channelQueryService,
    eventRecorder: deps.eventRecorder,
  });

  const sharedDeps = {
    authorization,
    pricingService,
    database: deps.database,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  };

  const useCases: PriceRoutesDependencies = {
    createPrice: new CreatePrice(sharedDeps),
    getPrice: new GetPrice({
      authorization,
      queryable: deps.database,
      prices,
    }),
    listPrices: new ListPrices({ authorization, pricingService }),
    updatePrice: new UpdatePrice(sharedDeps),
    deactivatePrice: new DeactivatePrice(sharedDeps),
  };

  return {
    pricingService,
    useCases,
    routes: priceRoutes,
  };
}

export { Price, PriceStatus } from './domain/index.js';
export type { PricingService } from './public/index.js';
