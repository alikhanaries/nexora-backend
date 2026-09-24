/**
 * Worker-only operational routes (ADR-026). Not mounted on the API server.
 */
export async function registerWorkerObservabilityRoutes(app, options) {
    app.get('/health/live', (_request, reply) => {
        if (!options.readiness.isAcceptingTraffic()) {
            return reply.status(503).send({ status: 'shutting_down' });
        }
        return { status: 'ok' };
    });
    app.get('/health/ready', async (_request, reply) => {
        const result = await options.readiness.evaluate();
        const statusCode = result.ready ? 200 : 503;
        return reply.status(statusCode).send({
            status: result.ready ? 'ready' : 'not_ready',
            checks: result.checks,
        });
    });
    if (options.metricsEnabled) {
        app.get('/internal/metrics', async (_request, reply) => {
            try {
                const body = await options.metrics.render();
                return reply.header('content-type', options.metrics.contentType).send(body);
            }
            catch {
                return reply.status(500).send('');
            }
        });
    }
    await Promise.resolve();
}
