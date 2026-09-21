import fp from 'fastify-plugin';
import { getRequestContext } from '../../../shared/context/request-context.js';
const loggingPlugin = async (app, options) => {
    app.addHook('onResponse', (request, reply, done) => {
        const context = getRequestContext();
        options.logger.info({
            method: request.method,
            route: request.routeOptions.url ?? request.url,
            statusCode: reply.statusCode,
            durationMs: reply.elapsedTime,
            ...(context?.traceId === undefined ? {} : { traceId: context.traceId }),
        }, 'HTTP request completed');
        done();
    });
    await Promise.resolve();
};
export default fp(loggingPlugin, { name: 'request-logging' });
