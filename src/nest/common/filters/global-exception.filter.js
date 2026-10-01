import { Catch, Logger } from '@nestjs/common';
import { mapErrorToHttp } from '../../../app/errors/error-mapper.js';
import { AppError, describeErrorForLog } from '../../../shared/errors/index.js';
import { getRequestContext } from '../../../shared/context/request-context.js';

export @Catch()
class GlobalExceptionFilter {
  constructor() {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const requestId = getRequestContext()?.requestId ?? 'unknown';
    const mapped = mapErrorToHttp(exception, requestId);

    const logPayload = {
      method: request.method,
      route: request.route?.path ?? request.originalUrl ?? request.url,
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
        response.setHeader(key, value);
      }
    }

    response.status(mapped.statusCode).json(mapped.body);
  }
}
