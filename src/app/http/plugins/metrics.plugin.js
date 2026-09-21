import fp from 'fastify-plugin';
const metricsPlugin = async (app, options) => {
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
