/**
 * Nest module for outbound webhook subscription management.
 * Registers WebhookSubscriptionsController backed by CORE_SERVICES.webhooks services.
 */
import { Module } from '@nestjs/common';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller.js';

@Module({
  controllers: [WebhookSubscriptionsController],
  providers: [],
})
class WebhookSubscriptionsModule {}
export { WebhookSubscriptionsModule };
