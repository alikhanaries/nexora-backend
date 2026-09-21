import { requireActorContext } from '../../../shared/context/require-principal.js';
import { toReturnResponse } from './return.mapper.js';
import { createReturnBodySchema, listReturnsQuerySchema, orderIdParamsSchema, returnIdParamsSchema, returnListSuccessResponseSchema, returnSuccessResponseSchema, } from './return.schemas.js';
const returnRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/orders/:orderId/returns', {
        schema: {
            tags: ['Returns'],
            summary: 'Create a return request for an order',
            params: orderIdParamsSchema,
            body: createReturnBodySchema,
            response: {
                201: returnSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.createReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            orderId: request.params.orderId,
            lines: request.body.lines.map((line) => ({
                orderLineId: line.orderLineId,
                quantity: line.quantity,
                ...(line.reason === undefined ? {} : { reason: line.reason }),
            })),
            ...(request.body.shipmentId === undefined ? {} : { shipmentId: request.body.shipmentId }),
            ...(request.body.reason === undefined ? {} : { reason: request.body.reason }),
        });
        void reply.status(201);
        return {
            success: true,
            data: toReturnResponse(returnDetail),
        };
    });
    typed.get('/api/v1/returns', {
        schema: {
            tags: ['Returns'],
            summary: 'List returns',
            querystring: listReturnsQuerySchema,
            response: {
                200: returnListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const page = await deps.listReturns.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
            ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
            ...(request.query.orderId === undefined ? {} : { orderId: request.query.orderId }),
            ...(request.query.status === undefined ? {} : { status: request.query.status }),
        });
        return {
            success: true,
            data: {
                items: page.items.map(toReturnResponse),
                nextCursor: page.nextCursor,
                hasMore: page.hasMore,
            },
        };
    });
    typed.get('/api/v1/returns/:returnId', {
        schema: {
            tags: ['Returns'],
            summary: 'Get a return by id',
            params: returnIdParamsSchema,
            response: {
                200: returnSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { return: returnDetail } = await deps.getReturn.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return {
            success: true,
            data: toReturnResponse(returnDetail),
        };
    });
    typed.post('/api/v1/returns/:returnId/approve', {
        schema: {
            tags: ['Returns'],
            summary: 'Approve a return request',
            params: returnIdParamsSchema,
            response: { 200: returnSuccessResponseSchema },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.approveReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return { success: true, data: toReturnResponse(returnDetail) };
    });
    typed.post('/api/v1/returns/:returnId/receive', {
        schema: {
            tags: ['Returns'],
            summary: 'Receive returned goods and restore inventory',
            params: returnIdParamsSchema,
            response: { 200: returnSuccessResponseSchema },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.receiveReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return { success: true, data: toReturnResponse(returnDetail) };
    });
    typed.post('/api/v1/returns/:returnId/complete', {
        schema: {
            tags: ['Returns'],
            summary: 'Complete a received return',
            params: returnIdParamsSchema,
            response: { 200: returnSuccessResponseSchema },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.completeReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return { success: true, data: toReturnResponse(returnDetail) };
    });
    typed.post('/api/v1/returns/:returnId/reject', {
        schema: {
            tags: ['Returns'],
            summary: 'Reject a return request',
            params: returnIdParamsSchema,
            response: { 200: returnSuccessResponseSchema },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.rejectReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return { success: true, data: toReturnResponse(returnDetail) };
    });
    typed.post('/api/v1/returns/:returnId/cancel', {
        schema: {
            tags: ['Returns'],
            summary: 'Cancel a return request',
            params: returnIdParamsSchema,
            response: { 200: returnSuccessResponseSchema },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { return: returnDetail } = await deps.cancelReturn.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            returnId: request.params.returnId,
        });
        return { success: true, data: toReturnResponse(returnDetail) };
    });
    await Promise.resolve();
};
export default returnRoutes;
