import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [],
})
class WebhooksModule {}
export { WebhooksModule };
