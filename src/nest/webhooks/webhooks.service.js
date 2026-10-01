import { Inject, Injectable } from '@nestjs/common';
import { getRequestContext } from '../../shared/context/request-context.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class WebhooksService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  /**
   * @param {string} ingressToken
   * @param {Record<string, string | string[] | undefined>} headers
   * @param {string} rawBody
   */
  async receiveMarketplaceWebhook(ingressToken, headers, rawBody) {
    const correlationId = getRequestContext()?.requestId ?? null;
    const result = await this.coreDomain.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute({
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
