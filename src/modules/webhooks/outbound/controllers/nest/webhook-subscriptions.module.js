import { Module } from '@nestjs/common';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller.js';

export @Module({
  controllers: [WebhookSubscriptionsController],
  providers: [],
})
class WebhookSubscriptionsModule {}
