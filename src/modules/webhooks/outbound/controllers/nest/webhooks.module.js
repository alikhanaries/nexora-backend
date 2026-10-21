/**
 * Nest module for inbound marketplace webhook ingress (tokenized URLs).
 * Registers WebhooksController; ingestion use cases from CORE_SERVICES.marketplaceWebhookIngestion.
 */
import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [],
})
class WebhooksModule {}
export { WebhooksModule };
