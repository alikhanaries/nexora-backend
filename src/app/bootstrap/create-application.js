import { createAuditModule } from '../../modules/audit/index.js';
import { createApiKeysModule } from '../../modules/api-keys/index.js';
import { createAuthorizationModule } from '../../modules/authorization/index.js';
import { AuthorizationMembershipPermissionResolver } from '../../modules/authorization/public/index.js';
import { PostgresMembershipRoleRepository } from '../../modules/authorization/infrastructure/postgres-membership-role-repository.js';
import { createIdentityModule } from '../../modules/identity/index.js';
import { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import { createMfaModule } from '../../modules/mfa/index.js';
import { createChannelsModule } from '../../modules/channels/index.js';
import { createInventoryModule } from '../../modules/inventory/index.js';
import { createMarketplacesModule, createMarketplaceConnectionServices, } from '../../modules/marketplaces/index.js';
import { createOffersModule } from '../../modules/offers/index.js';
import { createOrdersModule } from '../../modules/orders/index.js';
import { createCancellationsModule, } from '../../modules/cancellations/index.js';
import { createShipmentsModule } from '../../modules/shipments/index.js';
import { createPricingModule } from '../../modules/pricing/index.js';
import { createProductsModule } from '../../modules/products/index.js';
import { createReturnsModule } from '../../modules/returns/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';
import { createCompatibilityModule } from '../../modules/compatibility/index.js';
import { createExternalIdMappingModule } from '../../modules/external-id-mapping/index.js';
import { createWebhooksModule } from '../../modules/webhooks/index.js';
import { createMarketplaceWebhookIngestionModule } from '../../modules/marketplace-webhook-ingestion/index.js';
import { MarketplaceAdapterRuntimeFactory } from '../../modules/marketplaces/application/marketplace-adapter-runtime-factory.js';
import { PostgresMarketplaceConnectionRepository } from '../../modules/marketplaces/infrastructure/postgres-marketplace-connection-repository.js';
import { registerMarketplaceWebhookAdapters } from '../../modules/marketplaces/infrastructure/adapters/register-marketplace-webhook-adapters.js';
import { registerMarketplaceOutboundOrderLifecycleAdapters } from '../../modules/marketplaces/infrastructure/adapters/register-marketplace-outbound-order-lifecycle-adapters.js';
import { MarketplaceOutboundOrderLifecycleAdapterRegistry } from '../../modules/marketplaces/application/marketplace-outbound-order-lifecycle-adapter-registry.js';
import { ExecuteOutboundMarketplaceOrderLifecycleCommand } from '../../modules/marketplaces/application/execute-outbound-marketplace-order-lifecycle-command.js';
import { ShopifyOrderAdapter } from '../../modules/marketplaces/infrastructure/adapters/shopify/shopify-order-adapter.js';
import { PostgresOrderRepository } from '../../modules/orders/infrastructure/postgres-order-repository.js';
import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import { wireMarketplaceOrderIngestion } from './wire-marketplace-order-ingestion.js';
import { createHttpServer } from '../http/create-server.js';
import { createDefaultProbes, ReadinessService } from '../observability/readiness.js';
export async function createApplication(infra) {
    const audit = createAuditModule({ database: infra.database });
    const authorization = createAuthorizationModule({ database: infra.database });
    const membershipRoles = new PostgresMembershipRoleRepository();
    const membershipPermissions = new AuthorizationMembershipPermissionResolver(membershipRoles);
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
    const authenticateAccessToken = new AuthenticateAccessTokenUseCase({
        db: infra.database,
        accessTokenService: identity.auth.accessTokenService,
        refreshSessions: identity.repositories.refreshSessions,
        users: identity.repositories.users,
        membershipPermissions,
    });
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
        authorization: new DefaultAuthorizationService(),
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
    const marketplaceConnections = createMarketplaceConnectionServices({
        queryable: infra.database,
        secretEncryptor: identity.auth.secretEncryptor,
        channelQueryService: channels.channelQueryService,
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
        createChannelOrder: orders.createChannelOrder,
        marketplaceAdapterRuntimeFactory,
        shopifyAdminApiVersion: infra.config.marketplace.shopifyAdminApiVersion,
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
    });
    const executeOutboundMarketplaceOrderLifecycle = new ExecuteOutboundMarketplaceOrderLifecycleCommand({
        lifecycleAdapterRegistry: outboundOrderLifecycleAdapterRegistry,
        marketplaceAdapterRuntimeFactory,
        database: infra.database,
        idempotency: infra.idempotency,
    });
    const marketplaceWebhookIngestion = createMarketplaceWebhookIngestionModule({
        database: infra.database,
        idempotency: infra.idempotency,
        metrics: infra.metrics,
        logger: infra.logger,
        ingestNormalizedMarketplaceOrder: marketplaceOrderIngestion.ingestNormalizedMarketplaceOrder,
        ...(marketplaceOrderIngestion.lifecycleService === undefined
            ? {}
            : { marketplaceOrderLifecycleService: marketplaceOrderIngestion.lifecycleService }),
        registerMarketplaceWebhookAdapters: (registry) => registerMarketplaceWebhookAdapters(registry, {
            marketplaceAdapterRuntimeFactory,
            channelQueryService: channels.channelQueryService,
            database: infra.database,
            shopifyOrderAdapter,
        }),
    });
    const compatibility = createCompatibilityModule({
        rateLimiter: infra.rateLimiter,
        coreContracts: {
            productQueryService: products.productQueryService,
            channelQueryService: channels.channelQueryService,
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
        },
    });
    const httpServer = await createHttpServer({
        config: infra.config,
        logger: infra.logger,
        metrics: infra.metrics,
        readiness,
        tenants,
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
        webhooks,
        marketplaceWebhookIngestion,
        compatibility,
        authenticateAccessToken,
        verifyApiKey: apiKeys.useCases.verifyApiKey,
    });
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
        marketplaceWebhookIngestion,
        readiness,
        httpServer,
    };
}
