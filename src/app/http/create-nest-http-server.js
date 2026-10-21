/**
 * API HTTP server facade: Nest boot, `listen`/`close`, and in-process `inject` for tests.
 */
import { injectExpress } from '../../shared/http/express-inject.js';
import { createNestApplication } from './create-nest-application.js';

/**
 * NestJS + Express HTTP server for the API process.
 * `inject()` runs in-process HTTP against Express for integration tests.
 *
 * @param {ReturnType<import('../config/index.js').loadConfigFromEnvironment>} config
 * @param {{ logger: object, metrics: object, database: object | null, readiness?: object }} infra
 * @param {object | null} coreServices
 */
export async function createNestHttpServer(config, infra, coreServices) {
  const nestApp = await createNestApplication(config, infra, coreServices, {
    readiness: infra.readiness ?? undefined,
  });
  await nestApp.init();

  const expressInstance = nestApp.getHttpAdapter().getInstance();

  /** In-process HTTP against Express (integration tests). */
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
