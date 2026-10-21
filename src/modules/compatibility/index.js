import { CatalogCompatibilityCommand } from './services/catalog-compatibility-command.js';
import { CatalogCompatibilityQuery } from './services/catalog-compatibility-query.js';
import { CancellationCompatibilityCommand } from './services/cancellation-compatibility-command.js';
import { CancellationCompatibilityQuery } from './services/cancellation-compatibility-query.js';
import { ReturnCompatibilityCommand } from './services/return-compatibility-command.js';
import { ReturnCompatibilityQuery } from './services/return-compatibility-query.js';
import { OrderCompatibilityCommand } from './services/order-compatibility-command.js';
import { OrderCompatibilityQuery } from './services/order-compatibility-query.js';
import { ShipmentCompatibilityCommand } from './services/shipment-compatibility-command.js';
import { ShipmentCompatibilityQuery } from './services/shipment-compatibility-query.js';
import { CompatV2OrderQuery } from './services/compat-v2-order-query.js';
import { CompatV2IntegrationListQuery } from './services/compat-v2-integration-list-query.js';
import { CompatV2CatalogCommand } from './services/compat-v2-catalog-command.js';
import { CompatV2ShipmentDeliveryCommand } from './services/compat-v2-shipment-delivery-command.js';
import { CompatV2IntegrationProductsQuery } from './services/compat-v2-integration-products-query.js';
import { CompatV2ProductsQuery } from './services/compat-v2-products-query.js';
import { CompatV2OrderInvoiceQuery } from './services/compat-v2-order-invoice-query.js';

/**
 * @param {object} deps
 * @param {import('./services/core-contracts.js').CompatibilityCoreContracts} deps.coreContracts
 * @param {ReturnType<typeof import('../authorization/public/index.js').createDefaultAuthorizationService>} deps.authorization
 * @param {import('../../infrastructure/postgres/idempotency-service.js').PostgresIdempotencyService} deps.idempotency
 * @param {import('./services/catalog-compatibility-contracts.js').CompatibilityCatalogCommands} deps.catalogCommands
 * @param {import('../../infrastructure/redis/redis-rate-limiter.js').RedisRateLimiter} deps.rateLimiter
 */
export function createCompatibilityModule(deps) {
    const orderCompatibilityQuery = new OrderCompatibilityQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const orderCompatibilityCommand = new OrderCompatibilityCommand({
        orderCommandService: deps.coreContracts.orderCommandService,
        orderQueryService: deps.coreContracts.orderQueryService,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
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
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const compatV2OrderQuery = new CompatV2OrderQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
        externalIntegerIdMappingQueryService: deps.coreContracts.externalIntegerIdMappingQueryService,
    });
    const compatV2IntegrationListQuery = new CompatV2IntegrationListQuery({
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
    });
    const compatV2IntegrationProductsQuery = new CompatV2IntegrationProductsQuery({
        authorization: deps.authorization,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
        offerQueryService: deps.coreContracts.offerQueryService,
        productQueryService: deps.coreContracts.productQueryService,
    });
    const compatV2ProductsQuery = new CompatV2ProductsQuery({
        authorization: deps.authorization,
        productQueryService: deps.coreContracts.productQueryService,
    });
    const compatV2CatalogCommand = new CompatV2CatalogCommand({
        productQueryService: deps.coreContracts.productQueryService,
        createProduct: deps.coreContracts.createProduct,
        archiveProduct: deps.coreContracts.archiveProduct,
        deactivateProduct: deps.coreContracts.deactivateProduct,
        upsertProductContent: deps.coreContracts.upsertProductContent,
        getProductContent: deps.coreContracts.getProductContent,
        suspendOffer: deps.coreContracts.suspendOffer,
        activateOffer: deps.coreContracts.activateOffer,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
        inventoryService: deps.coreContracts.inventoryService,
        pricingService: deps.coreContracts.pricingService,
        offerQueryService: deps.coreContracts.offerQueryService,
    });
    const compatV2OrderInvoiceQuery = new CompatV2OrderInvoiceQuery({
        orderQueryService: deps.coreContracts.orderQueryService,
    });
    const compatV2ShipmentDeliveryCommand = new CompatV2ShipmentDeliveryCommand({
        shipmentQueryService: deps.coreContracts.shipmentQueryService,
        shipShipment: deps.coreContracts.shipShipment,
        deliverShipment: deps.coreContracts.deliverShipment,
    });
    const catalogCompatibilityCommand = new CatalogCompatibilityCommand({
        authorization: deps.authorization,
        idempotency: deps.idempotency,
        productQueryService: deps.coreContracts.productQueryService,
        commerceIntegrationQueryService: deps.coreContracts.commerceIntegrationQueryService,
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
    return {
        routeDeps: {
            orderCompatibilityQuery,
            compatV2OrderQuery,
            compatV2IntegrationListQuery,
            compatV2IntegrationProductsQuery,
            compatV2ProductsQuery,
            compatV2CatalogCommand,
            compatV2ShipmentDeliveryCommand,
            compatV2OrderInvoiceQuery,
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
