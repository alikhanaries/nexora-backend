import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';

export @Module({
  controllers: [WebhooksController],
  providers: [],
})
class WebhooksModule {}
