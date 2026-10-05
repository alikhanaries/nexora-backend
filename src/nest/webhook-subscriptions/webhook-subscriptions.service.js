import { Inject, Injectable } from '@nestjs/common';
import {
  toWebhookDeliveryResponse,
  toWebhookSubscriptionResponse,
} from '../../modules/webhooks/presentation/webhook.mapper.js';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { commerceActorFields } from '../common/commerce-actor.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

function actorFields(actor) {
  const { actorId, actorKind } = commerceActorFields(actor);
  return {
    actorId,
    actorKind,
    ...(actor.sessionId === undefined ? {} : { sessionId: actor.sessionId }),
  };
}

export @Injectable()
class WebhookSubscriptionsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get command() {
    return this.coreDomain.webhooks.webhookCommandService;
  }

  get query() {
    return this.coreDomain.webhooks.webhookQueryService;
  }

  async create(body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    const result = await this.command.createWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      url: body.url,
      ...(body.description === undefined ? {} : { description: body.description }),
      eventTypes: body.eventTypes,
    });
    return {
      ...toWebhookSubscriptionResponse(result.subscription),
      secret: result.secret,
    };
  }

  async list(query) {
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const page = await this.query.listWebhookSubscriptions({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: page.items.map(toWebhookSubscriptionResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async getById(webhookId) {
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const result = await this.query.getWebhookSubscription({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
    });
    return toWebhookSubscriptionResponse(result.subscription);
  }

  async update(webhookId, body) {
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    const result = await this.command.updateWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      subscriptionId: webhookId,
      ...(body.url === undefined ? {} : { url: body.url }),
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.eventTypes === undefined ? {} : { eventTypes: body.eventTypes }),
      ...(body.status === undefined ? {} : { status: body.status }),
    });
    return toWebhookSubscriptionResponse(result.subscription);
  }

  async delete(webhookId) {
    const actor = requireActorContext();
    const { actorId, actorKind } = actorFields(actor);
    await this.command.deleteWebhookSubscription({
      tenantId: actor.tenantId,
      actorId,
      actorKind,
      actorPermissions: actor.permissions,
      subscriptionId: webhookId,
    });
    return { deleted: true };
  }

  async rotateSecret(webhookId) {
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
      subscription: toWebhookSubscriptionResponse(result.subscription),
      secret: result.secret,
    };
  }

  async listDeliveries(webhookId, query) {
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const page = await this.query.listWebhookDeliveries({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.eventType === undefined ? {} : { eventType: query.eventType }),
    });
    return {
      items: page.items.map(toWebhookDeliveryResponse),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async getDelivery(webhookId, deliveryId) {
    const actor = requireActorContext();
    const { actorId } = actorFields(actor);
    const result = await this.query.getWebhookDelivery({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      actorId,
      subscriptionId: webhookId,
      deliveryId,
    });
    return toWebhookDeliveryResponse(result.delivery);
  }
}
