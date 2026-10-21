/**
 * Pricing domain: price records, effective pricing service, and CRUD use cases.
 * Re-exports price entity helpers from `./models`.
 */
import { createDefaultAuthorizationService } from '../authorization/public/index.js';
import {
    createCreatePrice,
    createDeactivatePrice,
    createDefaultPricingService,
    createGetPrice,
    createListPrices,
    createUpdatePrice,
} from './services/index.js';
import { createPostgresPriceRepository } from './repositories/index.js';

/**
 * @param {object} deps
 * @param {import('../../infrastructure/postgres/postgres-database.js').PostgresDatabase} deps.database
 * @param {import('../products/public/index.js').DefaultProductQueryService} deps.productQueryService
 * @param {import('../commerce-integrations/public/index.js').CommerceIntegrationQueryService} deps.commerceIntegrationQueryService
 * @param {import('../../shared/events/event-recorder.port.js').EventRecorderPort} deps.eventRecorder
 * @param {import('../audit/public/index.js').AuditRecorder} [deps.auditRecorder]
 * @returns {{ pricingService: import('./public/index.js').DefaultPricingService, useCases: object }}
 */
export function createPricingModule(deps) {
    const authorization = createDefaultAuthorizationService();
    const prices = createPostgresPriceRepository();
    const pricingService = createDefaultPricingService({
        transactionManager: deps.database,
        queryable: deps.database,
        prices,
        productQueryService: deps.productQueryService,
        commerceIntegrationQueryService: deps.commerceIntegrationQueryService,
        eventRecorder: deps.eventRecorder
    });
    const sharedDeps = {
        authorization,
        pricingService,
        database: deps.database,
        ...(deps.auditRecorder === undefined ? {} : { auditRecorder: deps.auditRecorder })
    };
    const useCases = {
        createPrice: createCreatePrice(sharedDeps),
        getPrice: createGetPrice({
            authorization,
            queryable: deps.database,
            prices
        }),
        listPrices: createListPrices({ authorization, pricingService }),
        updatePrice: createUpdatePrice(sharedDeps),
        deactivatePrice: createDeactivatePrice(sharedDeps)
    };
    return {
        pricingService,
        useCases
    };
}

export {
    createPriceEntity,
    reconstitutePrice,
    isPriceEffectiveAt,
    updatePriceEntity,
    deactivatePriceEntity,
    PriceStatus,
} from './models/index.js';
