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
import stockconnectCeRoutes from './presentation/stockconnect-ce.routes.js';
import { StockConnectCeOrderCompatibilityQuery } from './application/stockconnect-ce-order-compatibility-query.js';
import { StockConnectCeChannelCompatibilityQuery } from './application/stockconnect-ce-channel-compatibility-query.js';
import { StockConnectCeCatalogCommand } from './application/stockconnect-ce-catalog-command.js';
import { StockConnectCeShipmentDeliveryCommand } from './application/stockconnect-ce-shipment-delivery-command.js';
import { StockConnectCeOrderInvoiceQuery } from './application/stockconnect-ce-order-invoice-query.js';

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
    const stockConnectCeOrderCompatibilityQuery = new StockConnectCeOrderCompatibilityQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const stockConnectCeChannelCompatibilityQuery = new StockConnectCeChannelCompatibilityQuery({
        channelQueryService: deps.coreContracts.channelQueryService,
    });
    const stockConnectCeCatalogCommand = new StockConnectCeCatalogCommand({
        productQueryService: deps.coreContracts.productQueryService,
        createProduct: deps.coreContracts.createProduct,
        archiveProduct: deps.coreContracts.archiveProduct,
        deactivateProduct: deps.coreContracts.deactivateProduct,
        upsertProductContent: deps.coreContracts.upsertProductContent,
        getProductContent: deps.coreContracts.getProductContent,
        suspendOffer: deps.coreContracts.suspendOffer,
        activateOffer: deps.coreContracts.activateOffer,
        channelQueryService: deps.coreContracts.channelQueryService,
        inventoryService: deps.coreContracts.inventoryService,
        pricingService: deps.coreContracts.pricingService,
        offerQueryService: deps.coreContracts.offerQueryService,
    });
    const stockConnectCeOrderInvoiceQuery = new StockConnectCeOrderInvoiceQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
    });
    const stockConnectCeShipmentDeliveryCommand = new StockConnectCeShipmentDeliveryCommand({
        shipmentQueryService: deps.coreContracts.shipmentQueryService,
        shipShipment: deps.coreContracts.shipShipment,
        deliverShipment: deps.coreContracts.deliverShipment,
    });
    const catalogCompatibilityCommand = new CatalogCompatibilityCommand({
        authorization: deps.authorization,
        idempotency: deps.idempotency,
        productQueryService: deps.coreContracts.productQueryService,
        channelQueryService: deps.coreContracts.channelQueryService,
        inventoryService: deps.coreContracts.inventoryService,
        pricingService: deps.coreContracts.pricingService,
        offerQueryService: deps.coreContracts.offerQueryService,
        ...deps.catalogCommands,
    });
    const catalogCompatibilityQuery = new CatalogCompatibilityQuery({
        authorization: deps.authorization,
        productQueryService: deps.coreContracts.productQueryService,
        getProductContent: deps.catalogCommands.getProductContent,
    });
    const registerCompatibilityRoutes = async (app, routeDeps) => {
        await compatibilityRoutes(app, routeDeps);
        await stockconnectCeRoutes(app, routeDeps);
    };
    return {
        routes: registerCompatibilityRoutes,
        routeDeps: {
            orderCompatibilityQuery,
            stockConnectCeOrderCompatibilityQuery,
            stockConnectCeChannelCompatibilityQuery,
            stockConnectCeCatalogCommand,
            stockConnectCeShipmentDeliveryCommand,
            stockConnectCeOrderInvoiceQuery,
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
