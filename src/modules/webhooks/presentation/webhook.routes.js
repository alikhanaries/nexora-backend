import { requireActorContext } from '../../../shared/context/require-principal.js';
import { toWebhookDeliveryResponse, toWebhookSubscriptionResponse } from './webhook.mapper.js';
import {
    createWebhookBodySchema,
    listWebhookDeliveriesQuerySchema,
    listWebhooksQuerySchema,
    updateWebhookBodySchema,
    webhookCreateSuccessResponseSchema,
    webhookDeleteSuccessResponseSchema,
    webhookDeliveryListSuccessResponseSchema,
    webhookDeliveryParamsSchema,
    webhookDeliverySuccessResponseSchema,
    webhookIdParamsSchema,
    webhookRotateSuccessResponseSchema,
    webhookSubscriptionListSuccessResponseSchema,
    webhookSubscriptionSuccessResponseSchema,
} from './webhook.schemas.js';

function actorFields(actor) {
    return {
        actorId: actor.userId ?? actor.apiKeyId ?? actor.tenantId,
        actorKind: actor.apiKeyId === undefined ? 'user' : 'api-key',
        ...(actor.sessionId === undefined ? {} : { sessionId: actor.sessionId }),
    };
}

const webhookRoutes = async (app, options) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/webhooks', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Create a webhook subscription (secret shown once)',
            description: 'Requires webhooks.manage. Returns the signing secret exactly once in the response.',
            body: createWebhookBodySchema,
            response: {
                201: webhookCreateSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const { actorId, actorKind } = actorFields(actor);
        const result = await options.webhookCommandService.createWebhookSubscription({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            url: request.body.url,
            ...(request.body.description === undefined ? {} : { description: request.body.description }),
            eventTypes: request.body.eventTypes,
        });
        return reply.status(201).send({
            success: true,
            data: {
                ...toWebhookSubscriptionResponse(result.subscription),
                secret: result.secret,
            },
        });
    });
    typed.get('/api/v1/webhooks', {
        schema: {
            tags: ['Webhooks'],
            summary: 'List webhook subscriptions for the current tenant',
            description: 'Requires webhooks.read. Never returns secrets or ciphertext.',
            querystring: listWebhooksQuerySchema,
            response: {
                200: webhookSubscriptionListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId } = actorFields(actor);
        const query = listWebhooksQuerySchema.parse(request.query);
        const page = await options.webhookQueryService.listWebhookSubscriptions({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            ...(query.limit === undefined ? {} : { limit: query.limit }),
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
            ...(query.status === undefined ? {} : { status: query.status }),
        });
        return {
            success: true,
            data: {
                items: page.items.map(toWebhookSubscriptionResponse),
                nextCursor: page.nextCursor,
                hasMore: page.hasMore,
            },
        };
    });
    typed.get('/api/v1/webhooks/:webhookId', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Get a webhook subscription by id',
            description: 'Requires webhooks.read. Never returns secrets or ciphertext.',
            params: webhookIdParamsSchema,
            response: {
                200: webhookSubscriptionSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId } = actorFields(actor);
        const result = await options.webhookQueryService.getWebhookSubscription({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            subscriptionId: request.params.webhookId,
        });
        return {
            success: true,
            data: toWebhookSubscriptionResponse(result.subscription),
        };
    });
    typed.patch('/api/v1/webhooks/:webhookId', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Update a webhook subscription',
            description: 'Requires webhooks.manage. URL changes are re-validated for SSRF safety.',
            params: webhookIdParamsSchema,
            body: updateWebhookBodySchema,
            response: {
                200: webhookSubscriptionSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId, actorKind } = actorFields(actor);
        const result = await options.webhookCommandService.updateWebhookSubscription({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            subscriptionId: request.params.webhookId,
            ...(request.body.url === undefined ? {} : { url: request.body.url }),
            ...(request.body.description === undefined ? {} : { description: request.body.description }),
            ...(request.body.eventTypes === undefined ? {} : { eventTypes: request.body.eventTypes }),
            ...(request.body.status === undefined ? {} : { status: request.body.status }),
        });
        return {
            success: true,
            data: toWebhookSubscriptionResponse(result.subscription),
        };
    });
    typed.delete('/api/v1/webhooks/:webhookId', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Delete a webhook subscription (soft delete)',
            description: 'Requires webhooks.manage. Marks the subscription as DELETED; delivery history remains queryable.',
            params: webhookIdParamsSchema,
            response: {
                200: webhookDeleteSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId, actorKind } = actorFields(actor);
        await options.webhookCommandService.deleteWebhookSubscription({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            subscriptionId: request.params.webhookId,
        });
        return {
            success: true,
            data: { deleted: true },
        };
    });
    typed.post('/api/v1/webhooks/:webhookId/rotate-secret', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Rotate a webhook signing secret (requires step-up; secret shown once)',
            description: 'Requires webhooks.manage and recent MFA step-up. Returns the new secret exactly once.',
            params: webhookIdParamsSchema,
            response: {
                200: webhookRotateSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId, actorKind, sessionId } = actorFields(actor);
        if (sessionId === undefined) {
            throw new Error('Session is required for webhook secret rotation');
        }
        const result = await options.webhookCommandService.rotateWebhookSecret({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            sessionId,
            subscriptionId: request.params.webhookId,
        });
        return {
            success: true,
            data: {
                subscription: toWebhookSubscriptionResponse(result.subscription),
                secret: result.secret,
            },
        };
    });
    typed.get('/api/v1/webhooks/:webhookId/deliveries', {
        schema: {
            tags: ['Webhooks'],
            summary: 'List delivery history for a webhook subscription',
            description: 'Requires webhooks.read. Returns safe delivery metadata only.',
            params: webhookIdParamsSchema,
            querystring: listWebhookDeliveriesQuerySchema,
            response: {
                200: webhookDeliveryListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId } = actorFields(actor);
        const query = listWebhookDeliveriesQuerySchema.parse(request.query);
        const page = await options.webhookQueryService.listWebhookDeliveries({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            subscriptionId: request.params.webhookId,
            ...(query.limit === undefined ? {} : { limit: query.limit }),
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
            ...(query.status === undefined ? {} : { status: query.status }),
            ...(query.eventType === undefined ? {} : { eventType: query.eventType }),
        });
        return {
            success: true,
            data: {
                items: page.items.map(toWebhookDeliveryResponse),
                nextCursor: page.nextCursor,
                hasMore: page.hasMore,
            },
        };
    });
    typed.get('/api/v1/webhooks/:webhookId/deliveries/:deliveryId', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Get a single webhook delivery',
            description: 'Requires webhooks.read. Returns safe delivery metadata only.',
            params: webhookDeliveryParamsSchema,
            response: {
                200: webhookDeliverySuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { actorId } = actorFields(actor);
        const result = await options.webhookQueryService.getWebhookDelivery({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            actorId,
            subscriptionId: request.params.webhookId,
            deliveryId: request.params.deliveryId,
        });
        return {
            success: true,
            data: toWebhookDeliveryResponse(result.delivery),
        };
    });
    await Promise.resolve();
};
export default webhookRoutes;
