import express from 'express';
import supertest from 'supertest';
import { registerWorkerObservabilityRoutes } from './worker-observability.routes.js';

/**
 * Minimal Express app for worker liveness, readiness, and Prometheus scrape.
 */
export async function createWorkerObservabilityHttpServer(deps) {
  const app = express();
  app.set('trust proxy', false);
  registerWorkerObservabilityRoutes(app, {
    readiness: deps.readiness,
    metrics: deps.metrics,
    metricsEnabled: deps.metricsEnabled,
  });

  const inject = async (options) => {
    const method = (options.method ?? 'GET').toLowerCase();
    let req = supertest(app)[method](options.url);
    const headers = options.headers ?? {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        req = req.set(key, String(value));
      }
    }
    if (options.payload !== undefined) {
      req = req.send(options.payload);
    }
    const res = await req;
    return {
      statusCode: res.status,
      body: res.text,
      json() {
        if (typeof res.body === 'object' && res.body !== null) {
          return res.body;
        }
        if (res.text.length === 0) {
          return null;
        }
        return JSON.parse(res.text);
      },
    };
  };

  return {
    inject,
    close: () => Promise.resolve(),
    listen: (port, host, callback) => app.listen(port, host, callback),
  };
}
