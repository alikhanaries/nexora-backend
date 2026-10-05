import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createWebhookBodySchema,
  listWebhookDeliveriesQuerySchema,
  listWebhooksQuerySchema,
  updateWebhookBodySchema,
  webhookDeliveryParamsSchema,
  webhookIdParamsSchema,
} from '../../modules/webhooks/presentation/webhook.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service.js';

export @Controller()
class WebhookSubscriptionsController {
  constructor(@Inject(WebhookSubscriptionsService) service) {
    this.service = service;
  }

  @Post('/api/v1/webhooks')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createWebhookBodySchema, body, 'create webhook');
    const data = await this.service.create(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/webhooks')
  async list(@Query() query) {
    const parsed = listWebhooksQuerySchema.parse(query);
    const data = await this.service.list(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/webhooks/:webhookId')
  async getById(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const data = await this.service.getById(webhookId);
    return { success: true, data };
  }

  @Patch('/api/v1/webhooks/:webhookId')
  async update(@Param() params, @Body() body) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const parsed = parseOrThrow(updateWebhookBodySchema, body, 'update webhook');
    const data = await this.service.update(webhookId, parsed);
    return { success: true, data };
  }

  @Delete('/api/v1/webhooks/:webhookId')
  async delete(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const data = await this.service.delete(webhookId);
    return { success: true, data };
  }

  @Post('/api/v1/webhooks/:webhookId/rotate-secret')
  @HttpCode(200)
  async rotateSecret(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const data = await this.service.rotateSecret(webhookId);
    return { success: true, data };
  }

  @Get('/api/v1/webhooks/:webhookId/deliveries')
  async listDeliveries(@Param() params, @Query() query) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const parsed = listWebhookDeliveriesQuerySchema.parse(query);
    const data = await this.service.listDeliveries(webhookId, parsed);
    return { success: true, data };
  }

  @Get('/api/v1/webhooks/:webhookId/deliveries/:deliveryId')
  async getDelivery(@Param() params) {
    const parsed = parseOrThrow(webhookDeliveryParamsSchema, params, 'webhook delivery params');
    const data = await this.service.getDelivery(parsed.webhookId, parsed.deliveryId);
    return { success: true, data };
  }
}
