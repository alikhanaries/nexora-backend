import { CatalogCompatibilityCommand } from './application/catalog-compatibility-command.js';
import { CatalogCompatibilityQuery } from './application/catalog-compatibility-query.js';
import { CancellationCompatibilityCommand } from './application/cancellation-compatibility-command.js';
import { CancellationCompatibilityQuery } from './application/cancellation-compatibility-query.js';
import { ReturnCompatibilityCommand } from './application/return-compatibility-command.js';
import { ReturnCompatibilityQuery } from './application/return-compatibility-query.js';
import { OrderCompatibilityCommand } from './application/order-compatibility-command.js';
import { OrderCompatibilityQuery } from './application/order-compatibility-query.js';
import { ShipmentCompatibilityCommand } from './application/shipment-compatibility-command.js';
import { ShipmentCompatibilityQuery } from './application/shipment-compatibility-query.js';
import compatibilityRoutes from './presentation/compatibility.routes.js';

/**
 * @param {object} deps
 * @param {import('./application/core-contracts.js').CompatibilityCoreContracts} deps.coreContracts
 * @param {import('../authorization/public/index.js').DefaultAuthorizationService} deps.authorization
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('./application/catalog-compatibility-contracts.js').CompatibilityCatalogCommands} deps.catalogCommands
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 */
export function createCompatibilityModule(deps) {
    const orderCompatibilityQuery = new OrderCompatibilityQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const orderCompatibilityCommand = new OrderCompatibilityCommand({
        orderCommandService: deps.coreContracts.orderCommandService,
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const shipmentCompatibilityCommand = new ShipmentCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        shipmentCommandService: deps.coreContracts.shipmentCommandService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const cancellationCompatibilityCommand = new CancellationCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        cancellationCommandService: deps.coreContracts.cancellationCommandService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const returnCompatibilityCommand = new ReturnCompatibilityCommand({
        orderQueryService: deps.coreContracts.orderQueryService,
        returnQueryService: deps.coreContracts.returnQueryService,
        returnCommandService: deps.coreContracts.returnCommandService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const shipmentCompatibilityQuery = new ShipmentCompatibilityQuery({
        shipmentQueryService: deps.coreContracts.shipmentQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const cancellationCompatibilityQuery = new CancellationCompatibilityQuery({
        cancellationQueryService: deps.coreContracts.cancellationQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const returnCompatibilityQuery = new ReturnCompatibilityQuery({
        returnQueryService: deps.coreContracts.returnQueryService,
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const catalogCompatibilityCommand = new CatalogCompatibilityCommand({
        productQueryService: deps.coreContracts.productQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        inventoryService: deps.coreContracts.inventoryService,
        pricingService: deps.coreContracts.pricingService,
        offerQueryService: deps.coreContracts.offerQueryService,
        authorization: deps.authorization,
        idempotency: deps.idempotency,
        createProduct: deps.catalogCommands.createProduct,
        deactivateProduct: deps.catalogCommands.deactivateProduct,
        upsertProductContent: deps.catalogCommands.upsertProductContent,
        getProductContent: deps.catalogCommands.getProductContent,
        createPrice: deps.catalogCommands.createPrice,
        updatePrice: deps.catalogCommands.updatePrice,
        createOffer: deps.catalogCommands.createOffer,
        activateOffer: deps.catalogCommands.activateOffer,
        suspendOffer: deps.catalogCommands.suspendOffer,
        adjustInventory: deps.catalogCommands.adjustInventory,
    });
    const catalogCompatibilityQuery = new CatalogCompatibilityQuery({
        productQueryService: deps.coreContracts.productQueryService,
        getProductContent: deps.catalogCommands.getProductContent,
        authorization: deps.authorization,
    });
    return {
        routes: compatibilityRoutes,
        routeDeps: {
            orderCompatibilityQuery,
            orderCompatibilityCommand,
            shipmentCompatibilityCommand,
            shipmentCompatibilityQuery,
            cancellationCompatibilityCommand,
            cancellationCompatibilityQuery,
            returnCompatibilityCommand,
            returnCompatibilityQuery,
            catalogCompatibilityCommand,
            catalogCompatibilityQuery,
            rateLimiter: deps.rateLimiter,
        },
        coreContracts: deps.coreContracts,
    };
}
