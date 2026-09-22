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
import { createMarketplacesModule, } from '../../modules/marketplaces/index.js';
import { createOffersModule } from '../../modules/offers/index.js';
import { createOrdersModule } from '../../modules/orders/index.js';
import { createCancellationsModule, } from '../../modules/cancellations/index.js';
import { createShipmentsModule } from '../../modules/shipments/index.js';
import { createPricingModule } from '../../modules/pricing/index.js';
import { createProductsModule } from '../../modules/products/index.js';
import { createReturnsModule } from '../../modules/returns/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';
import { createCompatibilityModule } from '../../modules/compatibility/index.js';
import { createWebhooksModule } from '../../modules/webhooks/index.js';
import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import { createHttpServer } from '../http/create-server.js';
import { createDefaultProbes, ReadinessService } from '../observability/readiness.js';
export async function createApplication(infra) {
    const audit = createAuditModule({ database: infra.database });
    const authorization = createAuthorizationModule({ database: infra.database });
    const identity = await createIdentityModule({
        database: infra.database,
        config: infra.config,
        rateLimiter: infra.rateLimiter,
        auditRecorder: audit.auditRecorder,
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
    const membershipRoles = new PostgresMembershipRoleRepository();
    const membershipPermissions = new AuthorizationMembershipPermissionResolver(membershipRoles);
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
    const channels = createChannelsModule({
        database: infra.database,
        eventRecorder: infra.eventRecorder,
        verifyMarketplaceExists: marketplaces.verifyMarketplaceExists,
        auditRecorder: audit.auditRecorder,
    });
    const products = createProductsModule({
        database: infra.database,
        authorization: new DefaultAuthorizationService(),
        auditRecorder: audit.auditRecorder,
        eventRecorder: infra.eventRecorder,
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
    const inventory = createInventoryModule({
        queryable: infra.database,
        transactionManager: infra.database,
        productQueryService: products.productQueryService,
        eventRecorder: infra.eventRecorder,
        auditRecorder: audit.auditRecorder,
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
    });
    const cancellations = createCancellationsModule({
        database: infra.database,
        orderQueryService: orders.orderQueryService,
        orderFulfillmentService: orders.orderFulfillmentService,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
    });
    const shipments = createShipmentsModule({
        database: infra.database,
        orderFulfillmentService: orders.orderFulfillmentService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
    });
    const returns = createReturnsModule({
        database: infra.database,
        orderReturnGateway: orders.orderReturnGateway,
        inventoryService: inventory.inventoryService,
        eventRecorder: infra.eventRecorder,
        idempotency: infra.idempotency,
        auditRecorder: audit.auditRecorder,
    });
    const webhooks = createWebhooksModule({
        database: infra.database,
        secretEncryptor: identity.auth.secretEncryptor,
        rateLimiter: infra.rateLimiter,
        stepUpVerifier: mfa.stepUpService,
        auditRecorder: audit.auditRecorder,
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
        channels,
        products,
        pricing,
        offers,
        inventory,
        orders,
        cancellations,
        shipments,
        returns,
        webhooks,
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
        channels,
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
        readiness,
        httpServer,
    };
}
