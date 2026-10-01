import { Catch, Logger } from '@nestjs/common';
import { mapCoreErrorToExternalApiResponse } from '../../../modules/compatibility/application/errors/map-core-error.js';
import { RateLimitError, describeErrorForLog } from '../../../shared/errors/index.js';
import { getRequestContext } from '../../../shared/context/request-context.js';

/**
 * Merchant / StockConnect CE external API error envelope (matches Fastify v2 sub-app handler).
 */
export @Catch()
class CompatibilityExceptionFilter {
  constructor() {
    this.logger = new Logger(CompatibilityExceptionFilter.name);
  }

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
