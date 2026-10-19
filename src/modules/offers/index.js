import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { ActivateOffer, CreateOffer, DeactivateOffer, DefaultOfferQueryService, GetOffer, ListOffers, SuspendOffer, UpdateOffer, } from './services/index.js';
import { PostgresOfferRepository } from './repositories/index.js';
import offerRoutes, {} from './views/offer.routes.js';
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
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
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
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
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
export { Offer, OfferStatus, ListingStatus } from './models/index.js';
