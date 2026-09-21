import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { MetricsRecorder } from '../../../shared/metrics/index.js';

export interface MetricsPluginOptions {
  readonly metrics: MetricsRecorder;
}

const metricsPlugin: FastifyPluginAsync<MetricsPluginOptions> = async (app, options) => {
  app.addHook('onResponse', (request, reply, done) => {
    options.metrics.recordHttpRequest({
      method: request.method,
      route: request.routeOptions.url ?? 'unknown',
      statusCode: reply.statusCode,
      durationSeconds: reply.elapsedTime / 1_000,
    });
    done();
  });
  await Promise.resolve();
};

export default fp(metricsPlugin, { name: 'http-metrics' });
