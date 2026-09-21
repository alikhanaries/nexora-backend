const metricsRoutes = async (app, options) => {
    app.get('/internal/metrics', async (_request, reply) => {
        const body = await options.metrics.render();
        return reply.header('content-type', options.metrics.contentType).send(body);
    });
    await Promise.resolve();
};
export default metricsRoutes;
