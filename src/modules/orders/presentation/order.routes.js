import { requireActorContext } from '../../../shared/context/require-principal.js';
import { actorFingerprint } from '../../../shared/http/actor-fingerprint.js';
import { fingerprintRequest, requireIdempotencyKey, } from '../../../shared/idempotency/index.js';
import { toOrderDetailResponse, toOrderResponse } from './order.mapper.js';
import { createOrderBodySchema, listOrdersQuerySchema, orderIdParamsSchema, orderListSuccessResponseSchema, orderSuccessResponseSchema, } from './order.schemas.js';
function mapAddressInput(address) {
    if (address === undefined || address === null) {
        return null;
    }
    return {
        line1: address.line1 ?? null,
        line2: address.line2 ?? null,
        city: address.city ?? null,
        region: address.region ?? null,
        postalCode: address.postalCode ?? null,
        countryCode: address.countryCode ?? null,
    };
}
function mapCustomerInput(customer) {
    return {
        ...(customer.externalCustomerReference === undefined
            ? {}
            : { externalCustomerReference: customer.externalCustomerReference ?? null }),
        ...(customer.firstName === undefined ? {} : { firstName: customer.firstName ?? null }),
        ...(customer.lastName === undefined ? {} : { lastName: customer.lastName ?? null }),
        ...(customer.email === undefined ? {} : { email: customer.email ?? null }),
        ...(customer.phone === undefined ? {} : { phone: customer.phone ?? null }),
        ...(customer.companyName === undefined ? {} : { companyName: customer.companyName ?? null }),
        ...(customer.billingAddress === undefined
            ? {}
            : { billingAddress: mapAddressInput(customer.billingAddress) }),
        ...(customer.shippingAddress === undefined
            ? {}
            : { shippingAddress: mapAddressInput(customer.shippingAddress) }),
        ...(customer.metadata === undefined ? {} : { metadata: customer.metadata }),
    };
}
const orderRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/orders', {
        schema: {
            tags: ['Orders'],
            summary: 'Create an order',
            body: createOrderBodySchema,
            response: {
                201: orderSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);
        const outcome = await deps.idempotency.execute({
            tenantId: actor.tenantId,
            principalFingerprint: actorFingerprint(actor),
            routeId: 'POST /api/v1/orders',
            idempotencyKey,
        }, fingerprintRequest(request.body), async (tx) => {
            const { order } = await deps.createOrder.execute({
                tenantId: actor.tenantId,
                actorId,
                actorKind,
                actorPermissions: actor.permissions,
                channelId: request.body.channelId,
                currency: request.body.currency,
                lines: request.body.lines.map((line) => ({
                    productId: line.productId,
                    stockLocationId: line.stockLocationId,
                    quantity: line.quantity,
                    ...(line.offerId === undefined ? {} : { offerId: line.offerId ?? null }),
                })),
                ...(request.body.customer === undefined
                    ? {}
                    : { customer: mapCustomerInput(request.body.customer) }),
                ...(request.body.externalOrderReference === undefined
                    ? {}
                    : { externalOrderReference: request.body.externalOrderReference }),
                ...(request.body.discountMinor === undefined
                    ? {}
                    : { discountMinor: request.body.discountMinor }),
                ...(request.body.taxMinor === undefined ? {} : { taxMinor: request.body.taxMinor }),
                ...(request.body.shippingMinor === undefined
                    ? {}
                    : { shippingMinor: request.body.shippingMinor }),
                transaction: tx,
            });
            return {
                success: true,
                data: toOrderDetailResponse(order),
            };
        }, (body) => ({ statusCode: 201, body }), { useTransaction: true });
        void reply.status(201);
        return outcome.value;
    });
    typed.get('/api/v1/orders', {
        schema: {
            tags: ['Orders'],
            summary: 'List orders',
            querystring: listOrdersQuerySchema,
            response: {
                200: orderListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const page = await deps.listOrders.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(request.query.limit === undefined ? {} : { limit: request.query.limit }),
            ...(request.query.cursor === undefined ? {} : { cursor: request.query.cursor }),
            ...(request.query.status === undefined ? {} : { status: request.query.status }),
            ...(request.query.channelId === undefined ? {} : { channelId: request.query.channelId }),
            ...(request.query.externalOrderReference === undefined
                ? {}
                : { externalOrderReference: request.query.externalOrderReference }),
            ...(request.query.orderNumber === undefined
                ? {}
                : { orderNumber: request.query.orderNumber }),
            ...(request.query.createdAfter === undefined
                ? {}
                : { createdAfter: new Date(request.query.createdAfter) }),
            ...(request.query.createdBefore === undefined
                ? {}
                : { createdBefore: new Date(request.query.createdBefore) }),
        });
        return {
            success: true,
            data: {
                items: page.items.map(toOrderResponse),
                nextCursor: page.nextCursor,
                hasMore: page.hasMore,
            },
        };
    });
    typed.get('/api/v1/orders/:orderId', {
        schema: {
            tags: ['Orders'],
            summary: 'Get an order by id',
            params: orderIdParamsSchema,
            response: {
                200: orderSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { order } = await deps.getOrder.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            orderId: request.params.orderId,
        });
        return {
            success: true,
            data: toOrderDetailResponse(order),
        };
    });
    typed.post('/api/v1/orders/:orderId/confirm', {
        schema: {
            tags: ['Orders'],
            summary: 'Confirm an order',
            params: orderIdParamsSchema,
            response: {
                200: orderSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
        const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
        const { order } = await deps.confirmOrder.execute({
            tenantId: actor.tenantId,
            actorId,
            actorKind,
            actorPermissions: actor.permissions,
            orderId: request.params.orderId,
        });
        return {
            success: true,
            data: toOrderDetailResponse(order),
        };
    });
    await Promise.resolve();
};
export default orderRoutes;
