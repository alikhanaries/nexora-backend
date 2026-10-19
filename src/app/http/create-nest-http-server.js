import { injectExpress } from '../../shared/http/express-inject.js';
import { createNestApplication } from '../../nest/bootstrap/create-nest-application.js';

/**
 * NestJS + Express HTTP server with a Fastify-style `inject()` helper for integration tests.
 *
 * @param {ReturnType<import('../config/index.js').loadConfigFromEnvironment>} config
 * @param {{ logger: object, metrics: object, database: object | null, readiness?: object }} infra
 * @param {object | null} coreDomain
 */
export async function createNestHttpServer(config, infra, coreDomain) {
  const nestApp = await createNestApplication(config, infra, coreDomain, {
    readiness: infra.readiness ?? undefined,
  });
  await nestApp.init();

  const expressInstance = nestApp.getHttpAdapter().getInstance();

  const inject = (options) => injectExpress(expressInstance, options);

  return {
    nestApp,
    inject,
    ready: async () => {},
    close: () => nestApp.close(),
    listen: async (listenOptions) => {
      await nestApp.listen(listenOptions.port, listenOptions.host);
    },
  };
}
