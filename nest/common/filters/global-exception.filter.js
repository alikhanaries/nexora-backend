import { Catch, Logger } from '@nestjs/common';
import { mapErrorToHttp } from '../../../src/app/errors/error-mapper.js';
import { AppError, describeErrorForLog } from '../../../src/shared/errors/index.js';
import { getRequestContext } from '../../../src/shared/context/request-context.js';

export @Catch()
class GlobalExceptionFilter {
  constructor() {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  catch(exception, host) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse();
    const request = ctx.getRequest();

    const requestId = getRequestContext()?.requestId ?? 'unknown';
    const mapped = mapErrorToHttp(exception, requestId);

    const logPayload = {
      method: request.method,
      route: request.routeOptions?.url ?? request.url,
      statusCode: mapped.statusCode,
      err: describeErrorForLog(exception),
    };

    if (AppError.isAppError(exception) && exception.isOperational) {
      this.logger.warn(logPayload, 'HTTP request failed');
    } else {
      this.logger.error(logPayload, 'HTTP request failed');
    }

    if (mapped.headers !== undefined) {
      for (const [key, value] of Object.entries(mapped.headers)) {
        setResponseHeader(reply, key, value);
      }
    }

    sendHttpResponse(reply, mapped.statusCode, mapped.body);
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

function sendHttpResponse(reply, statusCode, body) {
  if (typeof reply.status === 'function' && typeof reply.send === 'function') {
    void reply.status(statusCode).send(body);
    return;
  }
  if (typeof reply.statusCode !== 'undefined') {
    reply.statusCode = statusCode;
  }
  if (typeof reply.setHeader === 'function') {
    reply.setHeader('content-type', 'application/json; charset=utf-8');
  }
  reply.end(JSON.stringify(body));
}
