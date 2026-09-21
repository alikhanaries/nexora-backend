import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import scalarReference from '@scalar/fastify-api-reference';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { AppConfig } from '../config/index.js';
import type { ReadinessService } from '../observability/readiness.js';
import type { Logger } from '../../shared/logging/index.js';
import type { MetricsRecorder } from '../../shared/metrics/index.js';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';
import loggingPlugin from './plugins/logging.plugin.js';
import metricsPlugin from './plugins/metrics.plugin.js';
import requestContextPlugin from './plugins/request-context.plugin.js';
import authenticationPlugin from './plugins/authentication.plugin.js';
import type { AuthorizationModule } from '../../modules/authorization/index.js';
import type { IdentityModule } from '../../modules/identity/index.js';
import type { TenantsModule } from '../../modules/tenants/index.js';
import type { AuditModule } from '../../modules/audit/index.js';
import type { ApiKeysModule } from '../../modules/api-keys/index.js';
import type { ChannelsModule } from '../../modules/channels/index.js';
import type { InventoryModule } from '../../modules/inventory/index.js';
import type { MarketplacesModule } from '../../modules/marketplaces/index.js';
import type { MfaModule } from '../../modules/mfa/index.js';
import type { OffersModule } from '../../modules/offers/index.js';
import type { PricingModule } from '../../modules/pricing/index.js';
import type { ProductsModule } from '../../modules/products/index.js';
import type { AuthenticateAccessTokenUseCase } from '../../modules/identity/application/authenticate-access-token.js';
import type { VerifyApiKeyUseCase } from '../../modules/api-keys/application/use-cases/verify-api-key.js';
import foundationRoutes from './routes/foundation.routes.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import type { HttpServer } from './types.js';

export interface HttpServerDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRecorder;
  readonly readiness: ReadinessService;
  readonly tenants: TenantsModule;
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
  readonly authenticateAccessToken: AuthenticateAccessTokenUseCase;
  readonly verifyApiKey: VerifyApiKeyUseCase;
}

export async function createHttpServer(deps: HttpServerDependencies): Promise<HttpServer> {
  const app = Fastify({
    logger: false,
    trustProxy: deps.config.server.trustProxy,
    bodyLimit: deps.config.server.bodyLimitBytes,
    disableRequestLogging: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  if (deps.config.security.corsEnabled) {
    await app.register(cors, {
      origin: [...deps.config.security.allowedOrigins],
      credentials: true,
    });
  }

  await app.register(requestContextPlugin, {
    trustIncomingRequestId: deps.config.security.trustIncomingRequestId,
  });
  await app.register(loggingPlugin, { logger: deps.logger });
  if (deps.config.observability.metricsEnabled) {
    await app.register(metricsPlugin, { metrics: deps.metrics });
  }
  await app.register(errorHandlerPlugin, { logger: deps.logger });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: `${deps.config.appName} API`,
        version: '0.1.0',
        description:
          'Nexora native API — tenants, identity, authorization, audit, API keys, MFA, commerce modules (marketplaces, channels, products, pricing, offers, inventory).',
      },
      servers: [{ url: `http://localhost:${deps.config.server.port}` }],
    },
    transform: jsonSchemaTransform,
  });

  if (deps.config.docsEnabled) {
    await app.register(scalarReference, {
      routePrefix: '/docs',
      configuration: { spec: { url: '/openapi.json' } },
    });
    app.get('/openapi.json', () => app.swagger());
  }

  await app.register(healthRoutes, { readiness: deps.readiness });
  if (deps.config.observability.metricsEnabled) {
    await app.register(metricsRoutes, { metrics: deps.metrics });
  }
  await app.register(foundationRoutes);
  await app.register(deps.tenants.routes, deps.tenants.useCases);
  await app.register(deps.identity.routes.auth);

  await app.register(authenticationPlugin, {
    authenticateAccessToken: deps.authenticateAccessToken,
    verifyApiKey: deps.verifyApiKey,
    metrics: deps.metrics,
  });

  await app.register(deps.authorization.routes.plugin, deps.authorization.routes.options);
  await app.register(deps.audit.routes.plugin, deps.audit.routes.options);
  await app.register(deps.apiKeys.routes.plugin, deps.apiKeys.routes.options);
  await app.register(deps.mfa.routes.plugin, deps.mfa.routes.options);
  await app.register(deps.marketplaces.routes, deps.marketplaces.useCases);
  await app.register(deps.channels.routes, deps.channels.useCases);
  await app.register(deps.products.routes, deps.products.useCases);
  await app.register(deps.pricing.routes, deps.pricing.useCases);
  await app.register(deps.offers.routes, deps.offers.useCases);
  await app.register(deps.inventory.routes, {
    ...deps.inventory.useCases,
    metrics: deps.metrics,
  });

  return app;
}
