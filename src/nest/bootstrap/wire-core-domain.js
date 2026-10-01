import { createAuditModule } from '../../modules/audit/index.js';
import { createAuthorizationModule } from '../../modules/authorization/index.js';
import { AuthorizationMembershipPermissionResolver } from '../../modules/authorization/public/index.js';
import { PostgresMembershipRoleRepository } from '../../modules/authorization/infrastructure/postgres-membership-role-repository.js';
import { createIdentityModule } from '../../modules/identity/index.js';
import { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import { createApiKeysModule } from '../../modules/api-keys/index.js';
import { createMfaModule } from '../../modules/mfa/index.js';
import { createTenantsModule } from '../../modules/tenants/index.js';
import { DefaultAuthorizationService } from '../../modules/authorization/public/index.js';
import { createChannelsModule } from '../../modules/channels/index.js';
import { createInventoryModule } from '../../modules/inventory/index.js';
import {
  createMarketplaceConnectionServices,
  createMarketplacesModule,
} from '../../modules/marketplaces/index.js';
import { createOffersModule } from '../../modules/offers/index.js';
import { createPricingModule } from '../../modules/pricing/index.js';
import { createProductsModule } from '../../modules/products/index.js';
import { PostgresOutboxRepository } from '../../infrastructure/postgres/outbox-repository.js';

/**
 * Wire core domain modules using the same factories as the Fastify application.
 *
 * @param {ReturnType<import('../../app/config/index.js').loadConfigFromEnvironment>} config
 * @param {NonNullable<Awaited<ReturnType<import('./create-nest-infrastructure.js').createNestInfrastructure>>['database']>} database
 * @param {{ rateLimiter?: object | null, metrics: object }} deps
 */
export async function wireCoreDomain(config, database, deps) {
  const audit = createAuditModule({ database });
  const authorization = createAuthorizationModule({ database });
  const membershipRoles = new PostgresMembershipRoleRepository();
  const membershipPermissions = new AuthorizationMembershipPermissionResolver(membershipRoles);

  const identity = await createIdentityModule({
    database,
    config,
    rateLimiter: deps.rateLimiter ?? undefined,
    auditRecorder: audit.auditRecorder,
    membershipPermissionResolver: membershipPermissions,
  });

  const mfa = createMfaModule({
    database,
    config,
    secretEncryptor: identity.auth.secretEncryptor,
    rateLimiter: deps.rateLimiter ?? undefined,
    auditRecorder: audit.auditRecorder,
  });

  const apiKeys = createApiKeysModule({
    database,
    rateLimiter: deps.rateLimiter ?? undefined,
    stepUpVerifier: mfa.stepUpService,
    auditRecorder: audit.auditRecorder,
  });

  const tenants = createTenantsModule({
    queryable: database,
    transactionManager: database,
  });

  const authenticateAccessToken = new AuthenticateAccessTokenUseCase({
    db: database,
    accessTokenService: identity.auth.accessTokenService,
    refreshSessions: identity.repositories.refreshSessions,
    users: identity.repositories.users,
    membershipPermissions,
  });

  const eventRecorder = new PostgresOutboxRepository(database);
  const defaultAuthorization = new DefaultAuthorizationService();

  const marketplaces = createMarketplacesModule({
    database,
    eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  const products = createProductsModule({
    database,
    authorization: defaultAuthorization,
    auditRecorder: audit.auditRecorder,
    eventRecorder,
  });

  const inventory = createInventoryModule({
    queryable: database,
    transactionManager: database,
    productQueryService: products.productQueryService,
    eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  const channels = createChannelsModule({
    database,
    eventRecorder,
    verifyMarketplaceExists: marketplaces.verifyMarketplaceExists,
    inventoryService: inventory.inventoryService,
    auditRecorder: audit.auditRecorder,
  });

  const marketplaceConnections = createMarketplaceConnectionServices({
    queryable: database,
    secretEncryptor: identity.auth.secretEncryptor,
    channelQueryService: channels.channelQueryService,
    auditRecorder: audit.auditRecorder,
    amazonLwaTokenUrl: config.marketplace.amazonLwaTokenUrl,
    noonApiBaseUrl: config.marketplace.noonApiBaseUrl,
    noonUserAgent: config.marketplace.noonUserAgent,
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
    database,
    productQueryService: products.productQueryService,
    channelQueryService: channels.channelQueryService,
    eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  const offers = createOffersModule({
    database,
    productQueryService: products.productQueryService,
    channelQueryService: channels.channelQueryService,
    pricingService: pricing.pricingService,
    eventRecorder,
    auditRecorder: audit.auditRecorder,
  });

  return {
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
    channels,
    marketplaces,
    channelRouteDeps,
    authenticateAccessToken,
    verifyApiKey: apiKeys.useCases.verifyApiKey,
    metrics: deps.metrics,
  };
}
