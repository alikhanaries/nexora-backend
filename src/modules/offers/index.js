import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createActivateOffer,
    createCreateOffer,
    createDeactivateOffer,
    createDefaultOfferQueryService,
    createGetOffer,
    createListOffers,
    createSuspendOffer,
    createUpdateOffer,
} from './services/index.js';
import { createPostgresOfferRepository } from './repositories/index.js';

export function createOffersModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const offers = createPostgresOfferRepository();
    const offerQueryService = createDefaultOfferQueryService({
        queryable: deps.database,
        offers
    });
    const lifecycleDeps = {
        authorization,
        database: deps.database,
        offers,
        eventRecorder: deps.eventRecorder,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const useCases = {
        createOffer: createCreateOffer({
            ...lifecycleDeps,
            productQueryService: deps.productQueryService,
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService
        }),
        getOffer: createGetOffer({ authorization, offerQueryService }),
        listOffers: createListOffers({
            authorization,
            queryable: deps.database,
            offers
        }),
        updateOffer: createUpdateOffer(lifecycleDeps),
        activateOffer: createActivateOffer({
            ...lifecycleDeps,
            productQueryService: deps.productQueryService,
            commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
            pricingService: deps.pricingService
        }),
        suspendOffer: createSuspendOffer(lifecycleDeps),
        deactivateOffer: createDeactivateOffer(lifecycleDeps)
    };
    return {
        offerQueryService,
        useCases
    };
}

export {
    createOfferEntity,
    reconstituteOffer,
    isOfferUsable,
    updateOfferEntity,
    activateOfferEntity,
    suspendOfferEntity,
    deactivateOfferEntity,
    OfferStatus,
    ListingStatus,
} from './models/index.js';
