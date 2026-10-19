import { Inject, Injectable } from '@nestjs/common';
import { getRequestContext } from '../../../../../shared/context/request-context.js';
import { CORE_SERVICES } from '../../../../../app/di/core-services.tokens.js';

export @Injectable()
class WebhooksService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  /**
   * @param {string} ingressToken
   * @param {Record<string, string | string[] | undefined>} headers
   * @param {string} rawBody
   */
  async receiveMarketplaceWebhook(ingressToken, headers, rawBody) {
    const correlationId = getRequestContext()?.requestId ?? null;
    const result = await this.coreServices.marketplaceWebhookIngestion.receiveMarketplaceWebhook.execute({
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
