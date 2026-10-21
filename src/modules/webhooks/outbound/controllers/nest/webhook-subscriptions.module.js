import { Module } from '@nestjs/common';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller.js';

@Module({
  controllers: [WebhookSubscriptionsController],
  providers: [],
})
class WebhookSubscriptionsModule {}
export { WebhookSubscriptionsModule };
