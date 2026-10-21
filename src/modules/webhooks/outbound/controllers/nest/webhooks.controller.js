import { Controller, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { getRequestContext } from '../../../../../shared/context/request-context.js';
import { Public } from '../../../../../app/common/decorators/public.decorator.js';
import { CORE_SERVICES } from '../../../../../app/di/core-services.tokens.js';
import { MARKETPLACE_WEBHOOK_INGRESS_ROUTES } from '../../routes/marketplace-webhook-ingress.routes.js';

const ingressTokenParamsSchema = z.object({
  ingressToken: z.string().min(16).max(128),
});

/**
 * Lowercases incoming header names for adapter signature verification.
 */
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

/**
 * Thin Nest HTTP adapter for inbound marketplace webhook ingress.
 * Business rules live in webhooks/marketplace services; paths live in routes/.
 * Route `/api/v1/inbound/marketplace-webhooks/:ingressToken`; handlers call `CORE_SERVICES.marketplaceWebhookIngestion`.
 */
@Controller()
class WebhooksController {
  /** Resolves marketplace webhook ingestion use cases from core DI. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.marketplaceWebhookIngestion;
  }

  /**
   * Public ingress for signed marketplace webhooks; resolves tenant connection, enqueues async processing (no outbound fan-out here).
   */
  @Public()
  @Post(MARKETPLACE_WEBHOOK_INGRESS_ROUTES.receiveMarketplaceWebhook.path)
  @HttpCode(200)
  async receiveMarketplaceWebhook(@Param() params, @Req() request) {
    const { ingressToken } = parseOrThrow(ingressTokenParamsSchema, params, 'ingress token');
    const rawBody = request.marketplaceWebhookRawBody ?? '';
    const headers = normalizeHeaders(request.headers);
    const correlationId = getRequestContext()?.requestId ?? null;
    const result = await this.useCases.receiveMarketplaceWebhook.execute({
      ingressToken,
      headers,
      rawBody,
      correlationId,
    });
    return {
      success: true,
      data: result.data,
      replayed: result.replayed,
    };
  }
}
export { WebhooksController };
