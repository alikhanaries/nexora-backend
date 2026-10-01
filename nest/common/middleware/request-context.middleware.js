import { Inject, Injectable } from '@nestjs/common';
import {
  createRequestContext,
  enterRequestContext,
  enrichRequestContext,
} from '../../../src/shared/context/request-context.js';
import { REQUEST_ID_HEADER, resolveRequestId } from '../../../src/shared/context/request-id.js';
import { currentTraceId } from '../../../src/infrastructure/observability/tracing.js';
import { NEXORA_CONFIG } from '../../config/config.module.js';

export @Injectable()
class RequestContextMiddleware {
  constructor(@Inject(NEXORA_CONFIG) config) {
    this.config = config;
  }

  use(request, reply, next) {
    const requestId = resolveRequestId(
      request.headers[REQUEST_ID_HEADER],
      this.config.server.trustIncomingRequestId,
    );
    setResponseHeader(reply, REQUEST_ID_HEADER, requestId);

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

    next();
  }
}

function setResponseHeader(reply, name, value) {
  if (typeof reply.header === 'function') {
    reply.header(name, value);
    return;
  }
  if (typeof reply.setHeader === 'function') {
    reply.setHeader(name, value);
  }
}
