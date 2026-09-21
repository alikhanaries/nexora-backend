import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { getRequestContext } from '../../../shared/context/request-context.js';
import { AppError, describeErrorForLog } from '../../../shared/errors/index.js';
import type { Logger } from '../../../shared/logging/index.js';
import { mapErrorToHttp } from '../../errors/error-mapper.js';

export interface ErrorHandlerPluginOptions {
  readonly logger: Logger;
}

const errorHandlerPlugin: FastifyPluginAsync<ErrorHandlerPluginOptions> = async (app, options) => {
  app.setErrorHandler((error, request, reply) => {
    const requestId = getRequestContext()?.requestId ?? 'unknown';
    const mapped = mapErrorToHttp(error, requestId);

    const logLevel = AppError.isAppError(error) && error.isOperational ? 'warn' : 'error';
    options.logger[logLevel](
      {
        method: request.method,
        route: request.routeOptions.url ?? request.url,
        statusCode: mapped.statusCode,
        err: describeErrorForLog(error),
      },
      'HTTP request failed',
    );

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
