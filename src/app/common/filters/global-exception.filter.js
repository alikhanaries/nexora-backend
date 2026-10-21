/**
 * Default Nest exception filter for internal Wasl API routes.
 * Converts thrown errors to the standard JSON error envelope and HTTP status.
 */
import { Catch, Logger } from '@nestjs/common';
import { mapErrorToHttp } from '../../errors/error-mapper.js';
import { AppError, describeErrorForLog } from '../../../shared/errors/index.js';
import { getRequestContext } from '../../../shared/context/request-context.js';

@Catch()
class GlobalExceptionFilter {
  /** Creates a Nest logger scoped to this filter. */
  constructor() {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  /**
   * Converts thrown errors to the standard Wasl API error envelope and writes the HTTP response.
   * Operational `AppError` instances are logged at warn; others at error. Applies optional headers (e.g. rate limits).
   * @param {unknown} exception
   * @param {import('@nestjs/common').ArgumentsHost} host
   */
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
export { GlobalExceptionFilter };
