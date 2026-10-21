/**
 * Nest exception filter for external compatibility and merchant `/api/v2` routes.
 * Maps domain errors to the external CE JSON envelope via `mapCoreErrorToExternalApiResponse`.
 */
import { Catch, Logger } from '@nestjs/common';
import { mapCoreErrorToExternalApiResponse } from '../../../modules/compatibility/services/errors/map-core-error.js';
import { RateLimitError, describeErrorForLog } from '../../../shared/errors/index.js';
import { getRequestContext } from '../../../shared/context/request-context.js';

@Catch()
class CompatibilityExceptionFilter {
  /** Creates a Nest logger scoped to this filter. */
  constructor() {
    this.logger = new Logger(CompatibilityExceptionFilter.name);
  }

  /**
   * Maps any thrown error to the external compatibility JSON envelope and sends the HTTP response.
   * Sets `Retry-After` on rate-limit errors; logs a structured warn with request id and route.
   * @param {unknown} exception
   * @param {import('@nestjs/common').ArgumentsHost} host
   */
  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const mapped = mapCoreErrorToExternalApiResponse(exception);

    if (exception instanceof RateLimitError) {
      response.setHeader('retry-after', String(exception.retryAfterSeconds));
    }

    this.logger.warn(
      {
        requestId: getRequestContext()?.requestId ?? 'unknown',
        method: request.method,
        route: request.route?.path ?? request.originalUrl ?? request.url,
        statusCode: mapped.statusCode,
        err: describeErrorForLog(exception),
      },
      'Compatibility API request failed',
    );

    response.status(mapped.statusCode).json(mapped.body);
  }
}
export { CompatibilityExceptionFilter };
