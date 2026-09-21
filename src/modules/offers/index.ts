import type { AuditRecorder } from '../audit/public/index.js';
import { DefaultAuthorizationService } from '../authorization/public/index.js';
import type { ChannelQueryService } from '../channels/public/index.js';
import type { PricingService } from '../pricing/public/index.js';
import type { ProductQueryService } from '../products/public/index.js';
import type { EventRecorder } from '../../shared/events/index.js';
import type { Queryable, TransactionManager } from '../../shared/persistence/index.js';
import {
  ActivateOffer,
  CreateOffer,
  DeactivateOffer,
  DefaultOfferQueryService,
  GetOffer,
  ListOffers,
  SuspendOffer,
  UpdateOffer,
} from './application/index.js';
import { PostgresOfferRepository } from './infrastructure/index.js';
import offerRoutes, { type OfferRoutesDependencies } from './presentation/offer.routes.js';
import type { OfferQueryService } from './public/index.js';

export interface OffersModuleDependencies {
  readonly database: TransactionManager & Queryable;
  readonly productQueryService: ProductQueryService;
  readonly channelQueryService: ChannelQueryService;
  readonly pricingService: PricingService;
  readonly eventRecorder: EventRecorder;
  readonly auditRecorder?: AuditRecorder;
}

export interface OffersModule {
  readonly offerQueryService: OfferQueryService;
  readonly useCases: OfferRoutesDependencies;
  readonly routes: typeof offerRoutes;
}

export function createOffersModule(deps: OffersModuleDependencies): OffersModule {
  const authorization = new DefaultAuthorizationService();
  const offers = new PostgresOfferRepository();

  const offerQueryService = new DefaultOfferQueryService({
    queryable: deps.database,
    offers,
  });

  const lifecycleDeps = {
    authorization,
    database: deps.database,
    offers,
    eventRecorder: deps.eventRecorder,
    ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder }),
  };

  const useCases: OfferRoutesDependencies = {
    createOffer: new CreateOffer({
      ...lifecycleDeps,
      productQueryService: deps.productQueryService,
      channelQueryService: deps.channelQueryService,
    }),
    getOffer: new GetOffer({ authorization, offerQueryService }),
    listOffers: new ListOffers({
      authorization,
      queryable: deps.database,
      offers,
    }),
    updateOffer: new UpdateOffer(lifecycleDeps),
    activateOffer: new ActivateOffer({
      ...lifecycleDeps,
      productQueryService: deps.productQueryService,
      channelQueryService: deps.channelQueryService,
      pricingService: deps.pricingService,
    }),
    suspendOffer: new SuspendOffer(lifecycleDeps),
    deactivateOffer: new DeactivateOffer(lifecycleDeps),
  };

  return {
    offerQueryService,
    useCases,
    routes: offerRoutes,
  };
}

export { Offer, OfferStatus, ListingStatus } from './domain/index.js';
export type { OfferQueryService } from './public/index.js';
