import { createAuditModule } from '../../modules/audit/index.js';
import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import { createCancellationsModule } from '../../modules/cancellations/index.js';
import { createChannelsModule } from '../../modules/channels/index.js';
import { createExternalIdMappingModule } from '../../modules/external-id-mapping/index.js';
import { createInventoryModule } from '../../modules/inventory/index.js';
import { createMarketplacesModule } from '../../modules/marketplaces/index.js';
import { createOffersModule } from '../../modules/offers/index.js';
import { createOrdersModule } from '../../modules/orders/index.js';
import { createPricingModule } from '../../modules/pricing/index.js';
import { createProductsModule } from '../../modules/products/index.js';
import { createReturnsModule } from '../../modules/returns/index.js';
import { createShipmentsModule } from '../../modules/shipments/index.js';
import { MarketplaceAdapterRuntimeFactory } from '../../modules/marketplaces/application/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { PostgresOrderRepository } from '../../modules/orders/infrastructure/postgres-order-repository.js';
import { registerMarketplaceOutboundOrderLifecycleAdapters } from '../../modules/marketplaces/infrastructure/adapters/register-marketplace-outbound-order-lifecycle-adapters.js';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../../modules/marketplaces/application/marketplace-outbound-order-lifecycle-adapter-registry.js';
import { ExecuteOutboundMarketplaceOrderLifecycleCommand } from '../../modules/marketplaces/application/execute-outbound-marketplace-order-lifecycle-command.js';
import { wireMarketplaceOrderIngestion } from './wire-marketplace-order-ingestion.js';

/**
 * Commerce + marketplace ingestion stack required by the lifecycle worker process.
 *
 * @param {object} infra
 * @param {import('../../infrastructure/auth/aes-secret-encryptor.js').AesSecretEncryptor} secretEncryptor
 */
export function createWorkerMarketplaceCommerceDeps(infra, secretEncryptor) {
    const audit = createAuditModule({ database: infra.database });
    const authorization = new DefaultAuthorizationService();
    const marketplaces = createMarketplacesModule({
        database: infra.database,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const products = createProductsModule({
        database: infra.database,
        authorization,
        auditRecorder: audit.auditRecorder,
        eventRecorder: infra.eventRecorder,
    });
    const inventory = createInventoryModule({
        queryable: infra.database,
        transactionManager: infra.database,
        productQueryService: products.productQueryService,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const channels = createChannelsModule({
        database: infra.database,
        eventRecorder: infra.eventRecorder,
        verifyMarketplaceExists: marketplaces.verifyMarketplaceExists,
        inventoryService: inventory.inventoryService,
        auditRecorder: audit.auditRecorder,
    });
    const pricing = createPricingModule({
        database: infra.database,
        productQueryService: products.productQueryService,
        channelQueryService: channels.channelQueryService,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const offers = createOffersModule({
        database: infra.database,
        productQueryService: products.productQueryService,
        channelQueryService: channels.channelQueryService,
        pricingService: pricing.pricingService,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const externalIdMapping = createExternalIdMappingModule({
        database: infra.database,
        logger: infra.logger,
    });
    const orders = createOrdersModule({
        database: infra.database,
        productQueryService: products.productQueryService,
        channelQueryService: channels.channelQueryService,
        offerQueryService: offers.offerQueryService,
        pricingService: pricing.pricingService,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
        externalIntegerIdMappingCommandService: externalIdMapping.externalIntegerIdMappingCommandService,
    });
    const cancellations = createCancellationsModule({
        database: infra.database,
        orderQueryService: orders.orderQueryService,
        orderFulfillmentService: orders.orderFulfillmentService,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
        externalIntegerIdMappingCommandService: externalIdMapping.externalIntegerIdMappingCommandService,
    });
    const shipments = createShipmentsModule({
        database: infra.database,
        orderFulfillmentService: orders.orderFulfillmentService,
        orderQueryService: orders.orderQueryService,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
        externalIntegerIdMappingCommandService: externalIdMapping.externalIntegerIdMappingCommandService,
    });
    orders.wireChannelFulfilledOrder({
        createShipment: shipments.useCases.createShipment,
        shipShipment: shipments.useCases.shipShipment,
        listShipmentsForOrder: shipments.listShipmentsForOrder,
    });
    const returns = createReturnsModule({
        database: infra.database,
        orderReturnGateway: orders.orderReturnGateway,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
        externalIntegerIdMappingCommandService: externalIdMapping.externalIntegerIdMappingCommandService,
    });
    const marketplaceAdapterRuntimeFactory = new MarketplaceAdapterRuntimeFactory({
        connections: new PostgresMarketplaceConnectionRepository(),
        secretEncryptor,
        queryable: infra.database,
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
    });
    const marketplaceOrderIngestion = wireMarketplaceOrderIngestion({
        database: infra.database,
        metrics: infra.metrics,
        logger: infra.logger,
        createChannelOrder: orders.createChannelOrder,
        marketplaceAdapterRuntimeFactory,
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
        amazonLwaTokenUrl: infra.config.marketplace.amazonLwaTokenUrl,
        orders: new PostgresOrderRepository(),
        confirmOrder: orders.useCases.confirmOrder,
        cancellationCommandService: cancellations.cancellationCommandService,
        returnCommandService: returns.returnCommandService,
        shipmentCommandService: shipments.shipmentCommandService,
        shipShipment: shipments.useCases.shipShipment,
        idempotency: infra.idempotency,
    });
    const outboundOrderLifecycleAdapterRegistry = new MarketplaceOutboundOrderLifecycleAdapterRegistry();
    registerMarketplaceOutboundOrderLifecycleAdapters(outboundOrderLifecycleAdapterRegistry, {
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
        amazonLwaTokenUrl: infra.config.marketplace.amazonLwaTokenUrl,
    });
    const executeOutboundMarketplaceOrderLifecycle = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
        lifecycleAdapterRegistry: outboundOrderLifecycleAdapterRegistry,
        marketplaceAdapterRuntimeFactory,
        database: infra.database,
        idempotency: infra.idempotency,
        channelQueryService: channels.channelQueryService,
        marketplaceLookup: marketplaceOrderIngestion.marketplaceLookup,
        metrics: infra.metrics,
        logger: infra.logger,
    });
    return {
        marketplaceOrderIngestion,
        executeOutboundMarketplaceOrderLifecycle,
        marketplaceAdapterRuntimeFactory,
        orderQueryService: orders.orderQueryService,
        channelQueryService: channels.channelQueryService,
        externalIntegerIdMappingQueryService: externalIdMapping.externalIntegerIdMappingQueryService,
    };
}
