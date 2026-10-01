import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

export @Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
class WebhooksModule {}
