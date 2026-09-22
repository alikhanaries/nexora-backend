import { z } from 'zod';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { RateLimitError } from '../../../shared/errors/index.js';
import { actorFingerprint } from '../../../shared/http/actor-fingerprint.js';
import { requireIdempotencyKey } from '../../../shared/idempotency/index.js';
import { enforceCompatibilityRateLimit } from '../application/enforce-compatibility-rate-limit.js';
import { mapCoreErrorToExternalApiResponse } from '../application/errors/map-core-error.js';
import { acknowledgeOrderBodySchema, externalAcknowledgeSuccessSchema, } from './compatibility-acknowledge.schemas.js';
import {
    createCancellationBodySchema,
    externalCancellationCollectionSchema,
    externalCancellationSuccessSchema,
    listMerchantCancellationsQuerySchema,
} from './compatibility-cancellation.schemas.js';
import {
    createReturnBodySchema,
    externalReturnCollectionSchema,
    externalReturnSuccessSchema,
    externalSingleOrderReturnCollectionSchema,
    listMerchantReturnsQuerySchema,
    listNewMerchantReturnsQuerySchema,
    merchantOrderNoParamsSchema,
} from './compatibility-return.schemas.js';
import {
    createShipmentBodySchema,
    externalShipmentCollectionSchema,
    externalShipmentSuccessSchema,
    listMerchantShipmentsQuerySchema,
} from './compatibility-shipment.schemas.js';
import { externalErrorResponseSchema, externalOrderCollectionSchema, listNewOrdersQuerySchema, listOrdersQuerySchema, } from './compatibility-order.schemas.js';

async function enforceReadRateLimit(deps) {
    const actor = requireActorContext();
    await enforceCompatibilityRateLimit({
        rateLimiter: deps.rateLimiter,
        actor,
        policy: COMPATIBILITY_RATE_LIMIT_POLICIES.read,
        category: 'read',
    });
}

async function enforceMutationRateLimit(deps) {
    const actor = requireActorContext();
    await enforceCompatibilityRateLimit({
        rateLimiter: deps.rateLimiter,
        actor,
        policy: COMPATIBILITY_RATE_LIMIT_POLICIES.mutation,
        category: 'mutation',
    });
}

/**
 * Merchant-compatible external API surface (`/api/v2`).
 *
 * Routes registered here reuse the existing authentication, authorization, tenant context,
 * rate limiting, and audit infrastructure — no second auth system.
 */
const compatibilityRoutes = async (app, deps) => {
    await app.register(async (v2App) => {
        v2App.setErrorHandler((error, request, reply) => {
            const mapped = mapCoreErrorToExternalApiResponse(error);
            if (error instanceof RateLimitError) {
                reply.header('retry-after', String(error.retryAfterSeconds));
            }
            void reply.status(mapped.statusCode).send(mapped.body);
        });
        const typed = v2App.withTypeProvider();
        typed.get('/api/v2/foundation/ping', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'Compatibility API liveness probe',
                description: 'Reserved Merchant-compatible API surface. Requires authentication via Bearer token or API key.',
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z.object({
                            message: z.literal('pong'),
                            apiVersion: z.literal('v2'),
                        }),
                    }),
                },
            },
        }, async () => {
            await enforceReadRateLimit(deps);
            return {
                success: true,
                data: { message: 'pong', apiVersion: 'v2' },
            };
        });
        typed.get('/api/v2/orders', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List orders by filter',
                description: 'Returns tenant-scoped orders matching the verified Merchant-compatible filters. '
                    + 'Unsupported external filters (integer channel/stock IDs, email, acknowledgement flags, etc.) are omitted — see compatibility matrix.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listOrdersQuerySchema,
                response: {
                    200: externalOrderCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.orderCompatibilityQuery.listOrders({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
                externalStatuses: request.query.Statuses,
                merchantOrderNos: request.query.MerchantOrderNos,
                channelOrderNos: request.query.ChannelOrderNos,
                fromDate: request.query.FromDate,
                toDate: request.query.ToDate,
                fromCreatedAtDate: request.query.FromCreatedAtDate,
                toCreatedAtDate: request.query.ToCreatedAtDate,
                fromUpdatedAtDate: request.query.FromUpdatedAtDate,
                toUpdatedAtDate: request.query.ToUpdatedAtDate,
            });
        });
        typed.get('/api/v2/orders/new', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List new orders',
                description: 'Returns orders in the external-compatible NEW state for the authenticated tenant. '
                    + 'Pagination uses Page and ItemsPerPage query parameters at this compatibility boundary.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listNewOrdersQuerySchema,
                response: {
                    200: externalOrderCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.orderCompatibilityQuery.listNewOrders({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
            });
        });
        typed.post('/api/v2/orders/acknowledge', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'Acknowledge an order',
                description: 'Acknowledges a merchant order import. Resolves the order by MerchantOrderNo (Nexora order number). '
                    + 'External integer OrderId is required by the contract but is not persisted or validated by Nexora.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                body: acknowledgeOrderBodySchema,
                response: {
                    201: externalAcknowledgeSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    429: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const actor = requireActorContext();
            const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
            const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
            const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);
            const body = await deps.orderCompatibilityCommand.acknowledgeOrder({
                tenantId: actor.tenantId,
                actorId,
                actorKind,
                actorPermissions: actor.permissions,
                body: request.body,
                idempotencyKey,
                principalFingerprint: actorFingerprint(actor),
            });
            return reply.status(201).send(body);
        });
        typed.get('/api/v2/shipments/merchant', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List merchant shipments',
                description: 'Returns tenant-scoped shipments matching verified Merchant-compatible filters. '
                    + 'MerchantShipmentNo maps to shipment externalReference. Unsupported filters (channel IDs, export status, etc.) are omitted — see compatibility matrix.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listMerchantShipmentsQuerySchema,
                response: {
                    200: externalShipmentCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.shipmentCompatibilityQuery.listMerchantShipments({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
                merchantShipmentNos: request.query.MerchantShipmentNos,
                merchantOrderNos: request.query.MerchantOrderNos,
                channelOrderNos: request.query.ChannelOrderNos,
                method: request.query.Method,
                fromShipmentDate: request.query.FromShipmentDate,
                toShipmentDate: request.query.ToShipmentDate,
                fromCreateDate: request.query.FromCreateDate,
                toCreateDate: request.query.ToCreateDate,
                fromUpdateDate: request.query.FromUpdateDate,
                toUpdateDate: request.query.ToUpdateDate,
                fromDeliveredAt: request.query.FromDeliveredAt,
                toDeliveredAt: request.query.ToDeliveredAt,
            });
        });
        typed.post('/api/v2/shipments', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'Create a merchant shipment',
                description: 'Marks an order as fully or partially shipped. Resolves the order by MerchantOrderNo (Nexora order number) '
                    + 'and lines by MerchantProductNo (order line merchantSku). MerchantShipmentNo is persisted as the shipment external reference (tenant-unique). '
                    + 'External integer OrderLineId and ShippedFromStockLocationId are accepted but not used.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                body: createShipmentBodySchema,
                response: {
                    201: externalShipmentSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    429: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const actor = requireActorContext();
            const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
            const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
            const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);
            const body = await deps.shipmentCompatibilityCommand.createShipment({
                tenantId: actor.tenantId,
                actorId,
                actorKind,
                actorPermissions: actor.permissions,
                body: request.body,
                idempotencyKey,
                principalFingerprint: actorFingerprint(actor),
            });
            return reply.status(201).send(body);
        });
        typed.get('/api/v2/cancellations/merchant', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List merchant cancellations',
                description: 'Returns tenant-scoped cancellations matching verified Merchant-compatible filters. '
                    + 'MerchantCancellationNo maps to cancellation externalReference.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listMerchantCancellationsQuerySchema,
                response: {
                    200: externalCancellationCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.cancellationCompatibilityQuery.listMerchantCancellations({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
                createdSince: request.query.CreatedSince,
                createdTo: request.query.CreatedTo,
                updatedSince: request.query.UpdatedSince,
                updatedTo: request.query.UpdatedTo,
                channelOrderNos: request.query.ChannelOrderNos,
                merchantOrderNos: request.query.MerchantOrderNos,
                merchantCancellationNos: request.query.MerchantCancellationNos,
            });
        });
        typed.post('/api/v2/cancellations', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'Create a merchant cancellation',
                description: 'Marks an order as fully or partially cancelled. Resolves the order by MerchantOrderNo (Nexora order number) '
                    + 'and lines by MerchantProductNo (order line merchantSku). MerchantCancellationNo is persisted as the cancellation external reference (tenant-unique). '
                    + 'External integer OrderLineId, ReasonCode, and IsMerchantCreator are accepted but not used.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                body: createCancellationBodySchema,
                response: {
                    201: externalCancellationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    429: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const actor = requireActorContext();
            const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
            const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
            const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);
            const body = await deps.cancellationCompatibilityCommand.createCancellation({
                tenantId: actor.tenantId,
                actorId,
                actorKind,
                actorPermissions: actor.permissions,
                body: request.body,
                idempotencyKey,
                principalFingerprint: actorFingerprint(actor),
            });
            return reply.status(201).send(body);
        });
        typed.get('/api/v2/returns/merchant/new', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List unhandled merchant returns',
                description: 'Returns marketplace returns in external IN_PROGRESS status. Maps to Nexora REQUESTED, APPROVED, and RECEIVED — see compatibility matrix.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listNewMerchantReturnsQuerySchema,
                response: {
                    200: externalReturnCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.returnCompatibilityQuery.listNewMerchantReturns({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
            });
        });
        typed.get('/api/v2/returns/merchant/:merchantOrderNo', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List returns for a merchant order',
                description: 'Implements external GET /v2/returns/merchant/{merchantOrderNo}. Returns all returns for the merchant order number (Nexora order number).',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                params: merchantOrderNoParamsSchema,
                response: {
                    200: externalSingleOrderReturnCollectionSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.returnCompatibilityQuery.listReturnsByMerchantOrderNo({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                merchantOrderNo: request.params.merchantOrderNo,
            });
        });
        typed.get('/api/v2/returns/merchant', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'List merchant returns',
                description: 'Returns tenant-scoped returns matching verified Merchant-compatible filters. '
                    + 'MerchantReturnNo maps to return externalReference. Unsupported filters (channel IDs, acknowledgement flags, etc.) are omitted — see compatibility matrix.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                querystring: listMerchantReturnsQuerySchema,
                response: {
                    200: externalReturnCollectionSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.returnCompatibilityQuery.listMerchantReturns({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.Page,
                pageSize: request.query.ItemsPerPage,
                merchantOrderNos: request.query.MerchantOrderNos,
                channelOrderNos: request.query.ChannelOrderNos,
                externalStatuses: request.query.Statuses,
                reasons: request.query.Reasons,
                fromDate: request.query.FromDate,
                toDate: request.query.ToDate,
                fromUpdateDate: request.query.FromUpdateDate,
                toUpdateDate: request.query.ToUpdateDate,
            });
        });
        typed.post('/api/v2/returns', {
            schema: {
                tags: ['Compatibility (v2)'],
                summary: 'Create a merchant return',
                description: 'Marks an order as fully or partially returned. Implements external POST /v2/returns/merchant. '
                    + 'Resolves the order by MerchantOrderNo (Nexora order number) and lines by MerchantProductNo (order line merchantSku). '
                    + 'MerchantReturnNo is persisted as the return external reference (tenant-unique). '
                    + 'External integer OrderLineId, Id, refund amounts, ReturnDate, ExtraData, Rma, and TrackTraceNo are accepted but not used.',
                security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
                body: createReturnBodySchema,
                response: {
                    201: externalReturnSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    429: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const actor = requireActorContext();
            const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
            const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
            const idempotencyKey = requireIdempotencyKey(request.headers['idempotency-key']);
            const body = await deps.returnCompatibilityCommand.createReturn({
                tenantId: actor.tenantId,
                actorId,
                actorKind,
                actorPermissions: actor.permissions,
                body: request.body,
                idempotencyKey,
                principalFingerprint: actorFingerprint(actor),
            });
            return reply.status(201).send(body);
        });
    });
    await Promise.resolve();
};
export default compatibilityRoutes;
