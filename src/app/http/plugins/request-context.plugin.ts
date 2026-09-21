import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  createRequestContext,
  enrichRequestContext,
  enterRequestContext,
} from '../../../shared/context/request-context.js';
import { REQUEST_ID_HEADER, resolveRequestId } from '../../../shared/context/request-id.js';
import { currentTraceId } from '../../../infrastructure/observability/tracing.js';

export interface RequestContextPluginOptions {
  readonly trustIncomingRequestId: boolean;
}

const requestContextPlugin: FastifyPluginAsync<RequestContextPluginOptions> = async (
  app,
  options,
) => {
  app.addHook('onRequest', (request, reply, done) => {
    const requestId = resolveRequestId(
      request.headers[REQUEST_ID_HEADER],
      options.trustIncomingRequestId,
    );
    reply.header(REQUEST_ID_HEADER, requestId);

    const context = createRequestContext({
      requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    enterRequestContext(context);
    const traceId = currentTraceId();
    if (traceId !== undefined) {
      enrichRequestContext({ traceId });
    }
    done();
  });
  await Promise.resolve();
};

export default fp(requestContextPlugin, { name: 'request-context' });
