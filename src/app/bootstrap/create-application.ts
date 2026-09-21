import { createAuditModule } from '../../modules/audit/index.js';
import type { AuditModule } from '../../modules/audit/index.js';
import { createApiKeysModule, type ApiKeysModule } from '../../modules/api-keys/index.js';
import { createAuthorizationModule } from '../../modules/authorization/index.js';
import type { AuthorizationModule } from '../../modules/authorization/index.js';
import { AuthorizationMembershipPermissionResolver } from '../../modules/authorization/public/index.js';
import { PostgresMembershipRoleRepository } from '../../modules/authorization/infrastructure/postgres-membership-role-repository.js';
import { createIdentityModule, type IdentityModule } from '../../modules/identity/index.js';
import { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import { createMfaModule, type MfaModule } from '../../modules/mfa/index.js';
import { createChannelsModule, type ChannelsModule } from '../../modules/channels/index.js';
import { createInventoryModule, type InventoryModule } from '../../modules/inventory/index.js';
import {
  createMarketplacesModule,
  type MarketplacesModule,
} from '../../modules/marketplaces/index.js';
import { createOffersModule, type OffersModule } from '../../modules/offers/index.js';
import { createOrdersModule, type OrdersModule } from '../../modules/orders/index.js';
import {
  createCancellationsModule,
  type CancellationsModule,
} from '../../modules/cancellations/index.js';
import { createShipmentsModule, type ShipmentsModule } from '../../modules/shipments/index.js';
import { createPricingModule, type PricingModule } from '../../modules/pricing/index.js';
import { createProductsModule, type ProductsModule } from '../../modules/products/index.js';
import { createReturnsModule, type ReturnsModule } from '../../modules/returns/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';
import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import type { HttpServer } from '../http/types.js';
import { createHttpServer } from '../http/create-server.js';
import { createDefaultProbes, ReadinessService } from '../observability/readiness.js';
import type { Infrastructure } from './create-infrastructure.js';

export interface Application {
  readonly infra: Infrastructure;
  readonly identity: IdentityModule;
  readonly authorization: AuthorizationModule;
  readonly audit: AuditModule;
  readonly apiKeys: ApiKeysModule;
  readonly mfa: MfaModule;
  readonly marketplaces: MarketplacesModule;
  readonly channels: ChannelsModule;
  readonly products: ProductsModule;
  readonly pricing: PricingModule;
  readonly offers: OffersModule;
  readonly inventory: InventoryModule;
  readonly orders: OrdersModule;
  readonly cancellations: CancellationsModule;
  readonly shipments: ShipmentsModule;
  readonly returns: ReturnsModule;
  readonly readiness: ReadinessService;
  readonly httpServer: HttpServer;
}

export async function createApplication(infra: Infrastructure): Promise<Application> {
  const audit = createAuditModule({ database: infra.database });
  const authorization = createAuthorizationModule({ database: infra.database });

  const identity = await createIdentityModule({
    database: infra.database,
    config: infra.config,
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

  const readiness = new ReadinessService(
    createDefaultProbes({
      database: infra.database,
      redis: infra.redis,
      queue: infra.queue,
      storage: infra.storage,
    }),
  );

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
    orders: orders.orders,
    orderFulfillmentService: orders.orderFulfillmentService,
    inventoryService: inventory.inventoryService,
    eventRecorder: infra.eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  const shipments = createShipmentsModule({
    database: infra.database,
    orderFulfillmentService: orders.orderFulfillmentService,
    eventRecorder: infra.eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  const returns = createReturnsModule({
    database: infra.database,
    inventoryService: inventory.inventoryService,
    eventRecorder: infra.eventRecorder,
    auditRecorder: audit.auditRecorder,
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
    readiness,
    httpServer,
  };
}
