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
} from '../../views/webhook.schemas.js';
import {
  toWebhookDeliveryResponse,
  toWebhookSubscriptionResponse,
} from '../../views/webhook.mapper.js';
import { parseOrThrow } from '../../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../../shared/context/require-principal.js';
import { commerceActorFields } from '../../../../../app/common/commerce-actor.js';
import { CORE_SERVICES } from '../../../../../app/di/core-services.tokens.js';
import { WEBHOOK_ROUTES } from '../../routes/webhook.routes.js';

/**
 * Extracts actorId/kind from Nest request context for audit on subscription mutations.
 */
function actorFields(actor) {
  const { actorId, actorKind } = commerceActorFields(actor);
  return {
    actorId,
    actorKind,
    ...(actor.sessionId === undefined ? {} : { sessionId: actor.sessionId }),
  };
}

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/ (webhook command/query services); paths live in routes/.
 * Route family `/api/v1/webhooks` (WEBHOOK_ROUTES); handlers call `CORE_SERVICES.webhooks` command/query services.
 */
@Controller()
class WebhookSubscriptionsController {
  /** Resolves outbound webhook command/query services from core DI. */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.webhooks;
  }

  /**
   * Accessor for webhook command/query service facades from core DI.
   */
  get command() {
    return this.useCases.webhookCommandService;
  }

  /** Accessor for webhook query service (reads subscriptions/deliveries). */
  get query() {
    return this.useCases.webhookQueryService;
  }

  /**
   * HTTP handler: create webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Post(WEBHOOK_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createWebhookBodySchema, body, 'create webhook');
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    const result = await this.command.createWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      url: parsed.url,
      ...(parsed.description === undefined ? {} : { description: parsed.description }),
      eventTypes: parsed.eventTypes,
    });
    return {
      success: true,
      data: {
        ...toWebhookSubscriptionResponse(result.subscription),
        secret: result.secret,
      },
    };
  }

  /**
   * HTTP handler: list webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Get(WEBHOOK_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listWebhooksQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const page = await this.query.listWebhookSubscriptions({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toWebhookSubscriptionResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  /**
   * HTTP handler: getById webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Get(WEBHOOK_ROUTES.getById.path)
  async getById(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const result = await this.query.getWebhookSubscription({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
    });
    return { success: true, data: toWebhookSubscriptionResponse(result.subscription) };
  }

  /**
   * HTTP handler: update webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Patch(WEBHOOK_ROUTES.update.path)
  async update(@Param() params, @Body() body) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const parsed = parseOrThrow(updateWebhookBodySchema, body, 'update webhook');
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    const result = await this.command.updateWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      subscriptionId: webhookId,
      ...(parsed.url === undefined ? {} : { url: parsed.url }),
      ...(parsed.description === undefined ? {} : { description: parsed.description }),
      ...(parsed.eventTypes === undefined ? {} : { eventTypes: parsed.eventTypes }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
    });
    return { success: true, data: toWebhookSubscriptionResponse(result.subscription) };
  }

  /**
   * HTTP handler: delete webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Delete(WEBHOOK_ROUTES.delete.path)
  async delete(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    await this.command.deleteWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      subscriptionId: webhookId,
    });
    return { success: true, data: { deleted: true } };
  }

  /**
   * HTTP handler: rotateSecret webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Post(WEBHOOK_ROUTES.rotateSecret.path)
  @HttpCode(200)
  async rotateSecret(@Param() params) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const actor = requireActorContext();
    const { actorId, actorKind, sessionId } = actorFields(actor);
    if (sessionId === undefined) {
      throw new Error('Session is required for webhook secret rotation');
    }
    const result = await this.command.rotateWebhookSecret({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      sessionId,
      subscriptionId: webhookId,
    });
    return {
      success: true,
      data: {
        subscription: toWebhookSubscriptionResponse(result.subscription),
        secret: result.secret,
      },
    };
  }

  /**
   * HTTP handler: listDeliveries webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Get(WEBHOOK_ROUTES.listDeliveries.path)
  async listDeliveries(@Param() params, @Query() query) {
    const { webhookId } = parseOrThrow(webhookIdParamsSchema, params, 'webhook params');
    const parsed = parseOrThrow(listWebhookDeliveriesQuerySchema, query, 'list query');
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const page = await this.query.listWebhookDeliveries({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.cursor === undefined ? {} : { cursor: parsed.cursor }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      ...(parsed.eventType === undefined ? {} : { eventType: parsed.eventType }),
    });
    return {
      success: true,
      data: {
        items: page.items.map(toWebhookDeliveryResponse),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    };
  }

  /**
   * HTTP handler: getDelivery webhook subscription/delivery resource (tenant from actor, webhooks permissions).
   */
  @Get(WEBHOOK_ROUTES.getDelivery.path)
  async getDelivery(@Param() params) {
    const { webhookId, deliveryId } = parseOrThrow(
      webhookDeliveryParamsSchema,
      params,
      'webhook delivery params',
    );
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const result = await this.query.getWebhookDelivery({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
      deliveryId,
    });
    return { success: true, data: toWebhookDeliveryResponse(result.delivery) };
  }
}
export { WebhookSubscriptionsController };
