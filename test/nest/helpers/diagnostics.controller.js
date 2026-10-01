import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ValidationError } from '../../../src/shared/errors/index.js';

/** Test-only controller; not registered on the production Nest AppModule. */
export @Controller()
class NestDiagnosticsController {
  @Get('/__nest_test/error')
  throwValidationError() {
    throw new ValidationError('Request validation failed', {
      issues: [{ path: 'field', message: 'Invalid request' }],
    });
  }

  @Post('/api/v1/inbound/marketplace-webhooks/:ingressToken')
  @HttpCode(200)
  echoWebhookRawBody(@Req() request) {
    return {
      rawBody: request.marketplaceWebhookRawBody ?? '',
      length: request.marketplaceWebhookRawBody?.length ?? 0,
    };
  }
}
