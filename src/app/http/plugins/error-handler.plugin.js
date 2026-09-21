import fp from 'fastify-plugin';
import { getRequestContext } from '../../../shared/context/request-context.js';
import { AppError, describeErrorForLog } from '../../../shared/errors/index.js';
import { mapErrorToHttp } from '../../errors/error-mapper.js';
const errorHandlerPlugin = async (app, options) => {
    app.setErrorHandler((error, request, reply) => {
        const requestId = getRequestContext()?.requestId ?? 'unknown';
        const mapped = mapErrorToHttp(error, requestId);
        const logLevel = AppError.isAppError(error) && error.isOperational ? 'warn' : 'error';
        options.logger[logLevel]({
            method: request.method,
            route: request.routeOptions.url ?? request.url,
            statusCode: mapped.statusCode,
            err: describeErrorForLog(error),
        }, 'HTTP request failed');
        if (mapped.headers !== undefined) {
            for (const [key, value] of Object.entries(mapped.headers)) {
                reply.header(key, value);
            }
        }
        void reply.status(mapped.statusCode).send(mapped.body);
    });
    await Promise.resolve();
};
export default fp(errorHandlerPlugin, { name: 'error-handler' });
