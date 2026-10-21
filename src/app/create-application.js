/**
 * Composition root for the API process.
 *
 * Wires every domain `create*Module` against shared infrastructure, builds
 * marketplace ingest/outbound adapters, registers readiness probes, then
 * hands `coreServices` to Nest (`createNestHttpServer`). Controllers stay thin:
 * they resolve use cases / `routeDeps` from this bag — business rules live in modules.
 */
import { createAuditModule } from '../modules/audit/index.js';
import { createApiKeysModule } from '../modules/api-keys/index.js';
import { createAuthorizationModule } from '../modules/authorization/index.js';
import {
    createAuthorizationMembershipPermissionResolver,
    createPostgresMembershipRoleRepository,
} from '../modules/authorization/public/index.js';
import { createIdentityModule } from '../modules/identity/index.js';
import { createMfaModule } from '../modules/mfa/index.js';
import { createCommerceIntegrationsModule } from '../modules/commerce-integrations/index.js';
import { createInventoryModule } from '../modules/inventory/index.js';
import { createMarketplacesModule, createMarketplaceConnectionServices, } from '../modules/marketplaces/index.js';
import { createOffersModule } from '../modules/offers/index.js';
import { createOrdersModule } from '../modules/orders/index.js';
import { createCancellationsModule, } from '../modules/cancellations/index.js';
import { createShipmentsModule } from '../modules/shipments/index.js';
import { createPricingModule } from '../modules/pricing/index.js';
import { createProductsModule } from '../modules/products/index.js';
import { createReturnsModule } from '../modules/returns/index.js';
import { createTenantsModule } from '../modules/tenants/index.js';
import { createCompatibilityModule } from '../modules/compatibility/index.js';
import {
    createExternalCompatibilityReadinessProbe,
    createCompatV2CompatibilityReadinessProbe,
} from '../modules/compatibility/services/compat-v2-readiness.js';
import { createStockConnectCeCompatibilityReadinessProbe } from '../modules/compatibility/services/stockconnect-ce-readiness.js';
import { createExternalIdMappingModule } from '../modules/external-id-mapping/index.js';
import { createWebhooksModule } from '../modules/webhooks/index.js';
import { createMarketplaceWebhookIngestionModule } from '../modules/webhooks/marketplace/index.js';
import { MarketplaceAdapterRuntimeFactory } from '../modules/marketplaces/services/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../modules/marketplaces/repositories/postgres-marketplace-connection-repository.js';
import { PostgresMarketplaceRepository } from '../modules/marketplaces/repositories/postgres-marketplace-repository.js';
import { registerMarketplaceWebhookAdapters } from '../modules/marketplaces/repositories/adapters/register-marketplace-webhook-adapters.js';
import { registerMarketplaceOutboundOrderLifecycleAdapters } from '../modules/marketplaces/repositories/adapters/register-marketplace-outbound-order-lifecycle-adapters.js';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../modules/marketplaces/services/marketplace-outbound-order-lifecycle-adapter-registry.js';
import { ExecuteOutboundMarketplaceOrderLifecycleCommand } from '../modules/marketplaces/services/execute-outbound-marketplace-order-lifecycle-command.js';
import { createMarketplaceLifecycleEnqueueService } from '../modules/orders/marketplace-ingestion/services/marketplace-lifecycle-enqueue-service.js';
import { EnqueueOutboundMarketplaceOrderLifecycleCommand } from '../modules/marketplaces/services/enqueue-outbound-marketplace-order-lifecycle-command.js';
import { ShopifyOrderAdapter } from '../modules/marketplaces/repositories/adapters/shopify/shopify-order-adapter.js';
import { createPostgresOrderRepository } from '../modules/orders/repositories/postgres-order-repository.js';
import { createDefaultAuthorizationService } from '../modules/authorization/public/index.js';
import { wireMarketplaceOrderIngestion } from './wire-marketplace-order-ingestion.js';
import { createNestHttpServer } from './http/create-nest-http-server.js';
import { createDefaultProbes, ReadinessService } from './observability/readiness.js';

/**
 * @param {Awaited<ReturnType<import('./create-infrastructure.js').createInfrastructure>>} infra
 * @returns {Promise<object>} Wired domain modules + Nest `httpServer` + readiness
 */
export async function createApplication(infra) {
    const audit = createAuditModule({ database: infra.database });
    const authorization = createAuthorizationModule({ database: infra.database });
    const membershipRoles = createPostgresMembershipRoleRepository();
    const membershipPermissions = createAuthorizationMembershipPermissionResolver({ membershipRoles });
    const identity = await createIdentityModule({
        database: infra.database,
        config: infra.config,
        rateLimiter: infra.rateLimiter,
        auditRecorder: audit.auditRecorder,
        membershipPermissionResolver: membershipPermissions,
    });
    const mfa = createMfaModule({
        database: infra.database,
        config: infra.config,
        secretEncryptor: identity.auth.secretEncryptor,
        rateLimiter: infra.rateLimiter,
        auditRecorder: audit.auditRecorder,
    });
    const apiKeys = createApiKeysModule({
        database: infra.database,
        config: infra.config,
        rateLimiter: infra.rateLimiter,
        stepUpVerifier: mfa.stepUpService,
        auditRecorder: audit.auditRecorder,
    });
    const authenticateAccessToken = identity.authenticateAccessToken;
    const readiness = new ReadinessService(createDefaultProbes({
        database: infra.database,
        redis: infra.redis,
        queue: infra.queue,
        storage: infra.storage,
    }));
    const tenants = createTenantsModule({
        queryable: infra.database,
        transactionManager: infra.database,
    });
    const marketplaces = createMarketplacesModule({
        database: infra.database,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const products = createProductsModule({
        database: infra.database,
        authorization: createDefaultAuthorizationService(),
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
    const channels = createCommerceIntegrationsModule({
        database: infra.database,
        eventRecorder: infra.eventRecorder,
        verifyMarketplaceExists: marketplaces.verifyMarketplaceExists,
        inventoryService: inventory.inventoryService,
        auditRecorder: audit.auditRecorder,
    });
    const marketplaceConnections = createMarketplaceConnectionServices({
        queryable: infra.database,
        secretEncryptor: identity.auth.secretEncryptor,
        commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
        auditRecorder: audit.auditRecorder,
        amazonLwaTokenUrl: infra.config.marketplace.amazonLwaTokenUrl,
        noonApiBaseUrl: infra.config.marketplace.noonApiBaseUrl,
        noonUserAgent: infra.config.marketplace.noonUserAgent,
    });
    const channelRouteDeps = {
        ...channels.useCases,
        upsertMarketplaceConnection: {
            execute: (input) => marketplaceConnections.commandService.upsertMarketplaceConnection(input),
        },
        getMarketplaceConnection: {
            execute: (input) => marketplaceConnections.queryService.getMarketplaceConnection(input),
        },
        patchMarketplaceConnection: {
            execute: (input) => marketplaceConnections.commandService.patchMarketplaceConnection(input),
        },
        deleteMarketplaceConnection: {
            execute: (input) => marketplaceConnections.commandService.deleteMarketplaceConnection(input),
        },
        testMarketplaceConnection: {
            execute: (input) => marketplaceConnections.commandService.testMarketplaceConnection(input),
        },
    };
    const pricing = createPricingModule({
        database: infra.database,
        productQueryService: products.productQueryService,
        commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
    });
    const offers = createOffersModule({
        database: infra.database,
        productQueryService: products.productQueryService,
        commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
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
        commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
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
    const webhooks = createWebhooksModule({
        database: infra.database,
        secretEncryptor: identity.auth.secretEncryptor,
        rateLimiter: infra.rateLimiter,
        stepUpVerifier: mfa.stepUpService,
        auditRecorder: audit.auditRecorder,
    });
    const marketplaceAdapterRuntimeFactory = new MarketplaceAdapterRuntimeFactory({
        connections: new PostgresMarketplaceConnectionRepository(),
        secretEncryptor: identity.auth.secretEncryptor,
        queryable: infra.database,
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
    });
    const shopifyOrderAdapter = new ShopifyOrderAdapter({
        deploymentDefaultApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
    });
    const marketplaceOrderIngestion = wireMarketplaceOrderIngestion({
        database: infra.database,
        metrics: infra.metrics,
        logger: infra.logger,
        createIntegrationOrder: orders.createIntegrationOrder,
        marketplaceAdapterRuntimeFactory,
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
        amazonLwaTokenUrl: infra.config.marketplace.amazonLwaTokenUrl,
        noonApiBaseUrl: infra.config.marketplace.noonApiBaseUrl,
        noonUserAgent: infra.config.marketplace.noonUserAgent,
        orders: createPostgresOrderRepository(),
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
        noonApiBaseUrl: infra.config.marketplace.noonApiBaseUrl,
        noonUserAgent: infra.config.marketplace.noonUserAgent,
    });
    const marketplaceRepository = new PostgresMarketplaceRepository();
    const marketplaceLifecycleEnqueueService = createMarketplaceLifecycleEnqueueService({
        queue: infra.queue,
        metrics: infra.metrics,
        lifecycleConfig: infra.config.marketplaceLifecycle,
    });
    const enqueueOutboundMarketplaceOrderLifecycle = new EnqueueOutboundMarketplaceOrderLifecycleCommand({
        lifecycleEnqueueService: marketplaceLifecycleEnqueueService,
    });
    const executeOutboundMarketplaceOrderLifecycle = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
        lifecycleAdapterRegistry: outboundOrderLifecycleAdapterRegistry,
        marketplaceAdapterRuntimeFactory,
        database: infra.database,
        idempotency: infra.idempotency,
        commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
        marketplaceLookup: {
            findById: async (marketplaceId) => {
                const marketplace = await marketplaceRepository.findById(infra.database, marketplaceId);
                if (marketplace === null) {
                    return null;
                }
                return {
                    id: marketplace.id,
                    key: marketplace.key,
                    status: marketplace.status,
                };
            },
        },
        metrics: infra.metrics,
        logger: infra.logger,
    });
    const marketplaceWebhookIngestion = createMarketplaceWebhookIngestionModule({
        database: infra.database,
        idempotency: infra.idempotency,
        metrics: infra.metrics,
        logger: infra.logger,
        productQueryService: products.productQueryService,
        lifecycleEnqueueService: marketplaceLifecycleEnqueueService,
        ingestNormalizedMarketplaceOrder: marketplaceOrderIngestion.ingestNormalizedMarketplaceOrder,
        ...(marketplaceOrderIngestion.processMarketplaceLifecyclePayload === undefined
            ? {}
            : { processMarketplaceLifecyclePayload: marketplaceOrderIngestion.processMarketplaceLifecyclePayload }),
        ...(marketplaceOrderIngestion.lifecycleService === undefined
            ? {}
            : { marketplaceOrderLifecycleService: marketplaceOrderIngestion.lifecycleService }),
        registerMarketplaceWebhookAdapters: (registry) => registerMarketplaceWebhookAdapters(registry, {
            marketplaceAdapterRuntimeFactory,
            commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
            database: infra.database,
            shopifyOrderAdapter,
        }),
    });
    const compatibility = createCompatibilityModule({
        rateLimiter: infra.rateLimiter,
        authorization: authorization.authorizationService,
        idempotency: infra.idempotency,
        coreContracts: {
            productQueryService: products.productQueryService,
            commerceIntegrationQueryService: channels.commerceIntegrationQueryService,
            inventoryService: inventory.inventoryService,
            pricingService: pricing.pricingService,
            offerQueryService: offers.offerQueryService,
            orderQueryService: orders.orderQueryService,
            orderFulfillmentService: orders.orderFulfillmentService,
            shipmentQueryService: shipments.shipmentQueryService,
            shipmentCommandService: shipments.shipmentCommandService,
            cancellationQueryService: cancellations.cancellationQueryService,
            cancellationCommandService: cancellations.cancellationCommandService,
            returnQueryService: returns.returnQueryService,
            returnCommandService: returns.returnCommandService,
            orderCommandService: orders.orderCommandService,
            externalIntegerIdMappingQueryService: externalIdMapping.externalIntegerIdMappingQueryService,
            createProduct: products.useCases.createProduct,
            archiveProduct: products.useCases.archiveProduct,
            deactivateProduct: products.useCases.deactivateProduct,
            upsertProductContent: products.useCases.upsertProductContent,
            getProductContent: products.useCases.getProductContent,
            suspendOffer: offers.useCases.suspendOffer,
            activateOffer: offers.useCases.activateOffer,
            shipShipment: shipments.useCases.shipShipment,
            deliverShipment: shipments.useCases.deliverShipment,
        },
        catalogCommands: {
            createProduct: products.useCases.createProduct,
            deactivateProduct: products.useCases.deactivateProduct,
            upsertProductContent: products.useCases.upsertProductContent,
            getProductContent: products.useCases.getProductContent,
            createPrice: pricing.useCases.createPrice,
            updatePrice: pricing.useCases.updatePrice,
            createOffer: offers.useCases.createOffer,
            activateOffer: offers.useCases.activateOffer,
            suspendOffer: offers.useCases.suspendOffer,
            adjustInventory: inventory.useCases.adjustInventory,
        },
    });
    readiness.registerProbe(createExternalCompatibilityReadinessProbe(compatibility.routeDeps));
    readiness.registerProbe(createCompatV2CompatibilityReadinessProbe(compatibility.routeDeps));
    readiness.registerProbe(createStockConnectCeCompatibilityReadinessProbe(compatibility.routeDeps));
    const coreServices = {
        identity,
        tenants,
        authorization,
        audit,
        apiKeys,
        mfa,
        products,
        pricing,
        offers,
        inventory,
        orders,
        cancellations,
        shipments,
        returns,
        compatibility,
        channels: { ...channels, routeDeps: channelRouteDeps },
        marketplaces,
        channelRouteDeps,
        marketplaceWebhookIngestion,
        webhooks,
        authenticateAccessToken,
        verifyApiKey: apiKeys.useCases.verifyApiKey,
        metrics: infra.metrics,
    };
    const httpServer = await createNestHttpServer(
        infra.config,
        {
            logger: infra.logger,
            metrics: infra.metrics,
            database: infra.database,
            readiness,
        },
        coreServices,
    );
    return {
        infra,
        identity,
        authorization,
        audit,
        apiKeys,
        mfa,
        marketplaces,
        channels: { ...channels, routeDeps: channelRouteDeps },
        products,
        pricing,
        offers,
        inventory,
        orders,
        cancellations,
        shipments,
        returns,
        compatibility,
        webhooks,
        marketplaceOrderIngestion,
        executeOutboundMarketplaceOrderLifecycle,
        enqueueOutboundMarketplaceOrderLifecycle,
        marketplaceLifecycleEnqueueService,
        marketplaceWebhookIngestion,
        readiness,
        httpServer,
    };
}
