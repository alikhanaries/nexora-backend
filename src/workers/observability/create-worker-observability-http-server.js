import express from 'express';
import { injectExpress } from '../../shared/http/express-inject.js';
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

  const inject = (options) => injectExpress(app, options);

  return {
    inject,
    close: () => Promise.resolve(),
    listen: (port, host, callback) => app.listen(port, host, callback),
  };
}
