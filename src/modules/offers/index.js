import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateOffer, CreateOffer, DeactivateOffer, DefaultOfferQueryService, GetOffer, ListOffers, SuspendOffer, UpdateOffer, } from './application/index.js';
import { PostgresOfferRepository } from './infrastructure/index.js';
import offerRoutes, {} from './presentation/offer.routes.js';
export function createOffersModule(deps) {
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
    const useCases = {
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
