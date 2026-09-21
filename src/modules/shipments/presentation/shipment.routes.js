import { requireActorContext } from '../../../shared/context/require-principal.js';
import { toShipmentDetailResponse, toShipmentResponse } from './shipment.mapper.js';
import { createShipmentBodySchema, listShipmentsQuerySchema, orderIdParamsSchema, shipmentIdParamsSchema, shipmentListSuccessResponseSchema, shipmentSuccessResponseSchema, shipShipmentBodySchema, } from './shipment.schemas.js';
const shipmentRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/orders/:orderId/shipments', {
        schema: {
            tags: ['Shipments'],
            summary: 'Create a shipment for an order',
            params: orderIdParamsSchema,
            body: createShipmentBodySchema,
            response: {
                201: shipmentSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { shipment } = await deps.createShipment.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            orderId: request.params.orderId,
            lines: request.body.lines,
            ...(request.body.carrier === undefined ? {} : { carrier: request.body.carrier }),
            ...(request.body.service === undefined ? {} : { service: request.body.service }),
            ...(request.body.trackingNumber === undefined
                ? {}
                : { trackingNumber: request.body.trackingNumber }),
        });
        void reply.status(201);
        return {
            success: true,
            data: toShipmentDetailResponse(shipment),
        };
    });
    typed.get('/api/v1/shipments', {
        schema: {
            tags: ['Shipments'],
            summary: 'List shipments',
            querystring: listShipmentsQuerySchema,
            response: {
                200: shipmentListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const page = await deps.listShipments.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
            ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
            ...(request.query.orderId === undefined ? {} : { orderId: request.query.orderId }),
            ...(request.query.status === undefined ? {} : { status: request.query.status }),
            ...(request.query.trackingNumber === undefined
                ? {}
                : { trackingNumber: request.query.trackingNumber }),
        });
        return {
            success: true,
            data: {
                items: page.items.map(toShipmentResponse),
                nextCursor: page.nextCursor,
                hasMore: page.hasMore,
            },
        };
    });
    typed.get('/api/v1/shipments/:shipmentId', {
        schema: {
            tags: ['Shipments'],
            summary: 'Get a shipment by id',
            params: shipmentIdParamsSchema,
            response: {
                200: shipmentSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { shipment } = await deps.getShipment.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            shipmentId: request.params.shipmentId,
        });
        return {
            success: true,
            data: toShipmentDetailResponse(shipment),
        };
    });
    typed.post('/api/v1/shipments/:shipmentId/ship', {
        schema: {
            tags: ['Shipments'],
            summary: 'Mark a shipment as shipped',
            params: shipmentIdParamsSchema,
            body: shipShipmentBodySchema,
            response: {
                200: shipmentSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { shipment } = await deps.shipShipment.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            shipmentId: request.params.shipmentId,
            ...(request.body.carrier === undefined ? {} : { carrier: request.body.carrier }),
            ...(request.body.service === undefined ? {} : { service: request.body.service }),
            ...(request.body.trackingNumber === undefined
                ? {}
                : { trackingNumber: request.body.trackingNumber }),
        });
        return {
            success: true,
            data: toShipmentDetailResponse(shipment),
        };
    });
    typed.post('/api/v1/shipments/:shipmentId/deliver', {
        schema: {
            tags: ['Shipments'],
            summary: 'Mark a shipment as delivered',
            params: shipmentIdParamsSchema,
            response: {
                200: shipmentSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { shipment } = await deps.deliverShipment.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            shipmentId: request.params.shipmentId,
        });
        return {
            success: true,
            data: toShipmentDetailResponse(shipment),
        };
    });
    typed.post('/api/v1/shipments/:shipmentId/cancel', {
        schema: {
            tags: ['Shipments'],
            summary: 'Cancel a shipment',
            params: shipmentIdParamsSchema,
            response: {
                200: shipmentSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { shipment } = await deps.cancelShipment.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            shipmentId: request.params.shipmentId,
        });
        return {
            success: true,
            data: toShipmentDetailResponse(shipment),
        };
    });
    await Promise.resolve();
};
export default shipmentRoutes;
