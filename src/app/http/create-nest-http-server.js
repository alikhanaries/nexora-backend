import supertest from 'supertest';
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

  const inject = async (options) => {
    const method = (options.method ?? 'GET').toLowerCase();
    let req = supertest(expressInstance)[method](options.url).buffer(true);

    const headers = options.headers ?? {};
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) {
        continue;
      }
      req = req.set(key, String(value));
    }

    if (options.payload !== undefined) {
      req = req.send(options.payload);
    }

    const res = await req;
    const rawPayload = Buffer.isBuffer(res.body)
      ? res.body
      : Buffer.from(res.text ?? '', 'utf8');
    return {
      statusCode: res.status,
      headers: res.headers,
      body: res.text,
      rawPayload,
      json() {
        if (typeof res.body === 'object' && res.body !== null && !Buffer.isBuffer(res.body)) {
          return res.body;
        }
        if ((res.text ?? '').length === 0) {
          return null;
        }
        return JSON.parse(res.text);
      },
    };
  };

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
