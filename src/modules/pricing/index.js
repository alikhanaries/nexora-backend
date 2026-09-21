import { DefaultAuthorizationService } from '../authorization/public/index.js';
import { CreatePrice, DeactivatePrice, DefaultPricingService, GetPrice, ListPrices, UpdatePrice, } from './application/index.js';
import { PostgresPriceRepository } from './infrastructure/index.js';
import priceRoutes, {} from './presentation/price.routes.js';
export function createPricingModule(deps) {
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
    const useCases = {
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
