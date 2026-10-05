import { Module } from '@nestjs/common';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller.js';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service.js';

export @Module({
  controllers: [WebhookSubscriptionsController],
  providers: [WebhookSubscriptionsService],
})
class WebhookSubscriptionsModule {}
