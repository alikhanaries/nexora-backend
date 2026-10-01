import { Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from '../../shared/validation/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { WebhooksService } from './webhooks.service.js';

const ingressTokenParamsSchema = z.object({
  ingressToken: z.string().min(16).max(128),
});

function normalizeHeaders(headers) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

export @Controller()
class WebhooksController {
  constructor(@Inject(WebhooksService) webhooksService) {
    this.webhooksService = webhooksService;
  }

  @Public()
  @Post('/api/v1/inbound/marketplace-webhooks/:ingressToken')
  @HttpCode(200)
  async receiveMarketplaceWebhook(@Param() params, @Req() request) {
    const { ingressToken } = parseOrThrow(ingressTokenParamsSchema, params, 'ingress token');
    const rawBody = request.marketplaceWebhookRawBody ?? '';
    const headers = normalizeHeaders(request.headers);
    return this.webhooksService.receiveMarketplaceWebhook(ingressToken, headers, rawBody);
  }
}
