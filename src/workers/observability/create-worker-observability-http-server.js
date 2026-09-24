import Fastify from 'fastify';
import { registerWorkerObservabilityRoutes } from './worker-observability.routes.js';
/**
 * Minimal Fastify app for worker liveness, readiness, and Prometheus scrape.
 */
export async function createWorkerObservabilityHttpServer(deps) {
    const app = Fastify({
        logger: false,
        disableRequestLogging: true,
    });
    await registerWorkerObservabilityRoutes(app, {
        readiness: deps.readiness,
        metrics: deps.metrics,
        metricsEnabled: deps.metricsEnabled,
    });
    return app;
}
