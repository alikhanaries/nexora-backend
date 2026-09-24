import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import scalarReference from '@scalar/fastify-api-reference';
import Fastify from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, } from 'fastify-type-provider-zod';
import errorHandlerPlugin from './plugins/error-handler.plugin.js';
import loggingPlugin from './plugins/logging.plugin.js';
import metricsPlugin from './plugins/metrics.plugin.js';
import requestContextPlugin from './plugins/request-context.plugin.js';
import authenticationPlugin from './plugins/authentication.plugin.js';
import foundationRoutes from './routes/foundation.routes.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
export async function createHttpServer(deps) {
    const app = Fastify({
        logger: false,
        trustProxy: deps.config.server.trustProxy,
        bodyLimit: deps.config.server.bodyLimitBytes,
        disableRequestLogging: true,
    }).withTypeProvider();
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
                description: 'Nexora APIs — `/api/v1` native surface and `/api/v2` Merchant-compatible compatibility surface (adapter boundary; core modules remain provider-neutral).',
            },
            servers: [{ url: `http://localhost:${deps.config.server.port}` }],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                    apiKeyAuth: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'x-api-key',
                    },
                },
            },
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
    await app.register(deps.channels.routes, deps.channels.routeDeps ?? deps.channels.useCases);
    await app.register(deps.products.routes, deps.products.useCases);
    await app.register(deps.pricing.routes, deps.pricing.useCases);
    await app.register(deps.offers.routes, deps.offers.useCases);
    await app.register(deps.inventory.routes, {
        ...deps.inventory.useCases,
        metrics: deps.metrics,
    });
    await app.register(deps.orders.routes, deps.orders.useCases);
    await app.register(deps.cancellations.routes, deps.cancellations.useCases);
    await app.register(deps.shipments.routes, deps.shipments.useCases);
    await app.register(deps.returns.routes, deps.returns.useCases);
    await app.register(deps.webhooks.routes.plugin, deps.webhooks.routes.options);
    await app.register(deps.compatibility.routes, deps.compatibility.routeDeps);
    return app;
}
