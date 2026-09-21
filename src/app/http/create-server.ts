import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import scalarReference from '@scalar/fastify-api-reference';
import Fastify from 'fastify';
import {
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
import foundationRoutes from './routes/foundation.routes.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import type { HttpServer } from './types.js';

export interface HttpServerDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly metrics: MetricsRecorder;
  readonly readiness: ReadinessService;
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
        description: 'Nexora native API — Phase 1 foundation endpoints only.',
      },
      servers: [{ url: `http://localhost:${deps.config.server.port}` }],
    },
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

  return app;
}
