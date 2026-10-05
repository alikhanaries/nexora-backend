/**
 * Worker-only operational routes (ADR-026). Not mounted on the API server.
 *
 * @param {import('express').Express} app
 * @param {object} options
 */
export function registerWorkerObservabilityRoutes(app, options) {
  app.get('/health/live', (_req, res) => {
    if (!options.readiness.isAcceptingTraffic()) {
      res.status(503).json({ status: 'shutting_down' });
      return;
    }
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    const result = await options.readiness.evaluate();
    const statusCode = result.ready ? 200 : 503;
    res.status(statusCode).json({
      status: result.ready ? 'ready' : 'not_ready',
      checks: result.checks,
    });
  });

  if (options.metricsEnabled) {
    app.get('/internal/metrics', async (_req, res) => {
      try {
        const body = await options.metrics.render();
        res.setHeader('content-type', options.metrics.contentType);
        res.send(body);
      } catch {
        res.status(500).send('');
      }
    });
  }
}
