import type { FastifyPluginAsync } from 'fastify';
import type { ReadinessService } from '../../observability/readiness.js';

export interface HealthRoutesOptions {
  readonly readiness: ReadinessService;
}

const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get('/health/live', () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    const result = await options.readiness.evaluate();
    const statusCode = result.ready ? 200 : 503;
    return reply.status(statusCode).send({
      status: result.ready ? 'ready' : 'not_ready',
      checks: result.checks,
    });
  });
  await Promise.resolve();
};

export default healthRoutes;
