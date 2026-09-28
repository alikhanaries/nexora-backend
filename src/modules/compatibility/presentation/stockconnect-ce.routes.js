import { z } from 'zod';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { RateLimitError } from '../../../shared/errors/index.js';
import { actorFingerprint } from '../../../shared/http/actor-fingerprint.js';
import { enforceCompatibilityRateLimit } from '../application/enforce-compatibility-rate-limit.js';
import { mapCoreErrorToExternalApiResponse } from '../application/errors/map-core-error.js';
import {
    resolveStockConnectCeIdempotencyKey,
    stableIdempotencyFingerprint,
} from '../application/resolve-stockconnect-ce-idempotency-key.js';
import {
    acknowledgeOrderBodySchema,
    externalAcknowledgeSuccessSchema,
} from './compatibility-acknowledge.schemas.js';
import {
    createCancellationBodySchema,
    externalCancellationSuccessSchema,
} from './compatibility-cancellation.schemas.js';
import { externalErrorResponseSchema } from './compatibility-order.schemas.js';
import {
    acknowledgeReturnBodySchema,
    createReturnBodySchema,
    externalReturnCollectionSchema,
    externalReturnMutationSuccessSchema,
    externalReturnSuccessSchema,
    receiveReturnBodySchema,
} from './compatibility-return.schemas.js';
import {
    createShipmentBodySchema,
    externalShipmentCollectionSchema,
    externalShipmentSuccessSchema,
} from './compatibility-shipment.schemas.js';
import { stockConnectCeOrderCollectionSchema } from './stockconnect-ce-order.schemas.js';

const stockConnectCeOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    apiKey: z.string().optional(),
    apikey: z.string().optional(),
});

const stockConnectCeApiKeyQuerySchema = z.object({
    apiKey: z.string().optional(),
    apikey: z.string().optional(),
});

function stockConnectMutationContext(request, routeId) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
    const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
    return {
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        principalFingerprint: actorFingerprint(actor),
        idempotencyKey: resolveStockConnectCeIdempotencyKey({
            header: request.headers['idempotency-key'],
            tenantId: actor.tenantId,
            routeId,
            fingerprint: stableIdempotencyFingerprint(request.body),
        }),
        body: request.body,
    };
}

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
 * StockConnect / ChannelEngine-style merchant compatibility routes (`/api/v2/ce/*`).
 * Additive surface ΓÇö existing `/api/v2/*` contracts are unchanged.
 */
const stockconnectCeRoutes = async (app, deps) => {
    await app.register(async (ceApp) => {
        ceApp.setErrorHandler((error, request, reply) => {
            const mapped = mapCoreErrorToExternalApiResponse(error);
            if (error instanceof RateLimitError) {
                reply.header('retry-after', String(error.retryAfterSeconds));
            }
            void reply.status(mapped.statusCode).send(mapped.body);
        });
        const typed = ceApp.withTypeProvider();

        typed.get('/api/v2/ce/orders', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'List orders (StockConnect CE poll)',
                description: 'ChannelEngine-style order list for StockConnect polling (`page`, `pageSize`, query `apiKey`). '
                    + 'Does not replace GET /api/v2/orders or GET /api/v2/orders/new.',
                querystring: stockConnectCeOrdersQuerySchema,
                response: {
                    200: stockConnectCeOrderCollectionSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.stockConnectCeOrderCompatibilityQuery.listOrdersForStockConnectPoll({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.page,
                pageSize: request.query.pageSize,
            });
        });

        typed.post('/api/v2/ce/orders/acknowledge', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Acknowledge an order (StockConnect CE)',
                description: 'Same behavior as POST /api/v2/orders/acknowledge with CE query auth and optional Idempotency-Key '
                    + '(deterministic key generated when omitted).',
                querystring: z.object({
                    apiKey: z.string().optional(),
                    apikey: z.string().optional(),
                }),
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
            const routeId = 'POST /api/v2/ce/orders/acknowledge';
            const idempotencyKey = resolveStockConnectCeIdempotencyKey({
                header: request.headers['idempotency-key'],
                tenantId: actor.tenantId,
                routeId,
                fingerprint: stableIdempotencyFingerprint(request.body),
            });
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

        typed.post('/api/v2/ce/cancellations', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Create a merchant cancellation',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: createCancellationBodySchema,
                response: {
                    201: externalCancellationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/cancellations');
            const body = await deps.cancellationCompatibilityCommand.createCancellation(ctx);
            return reply.status(201).send(body);
        });

        typed.post('/api/v2/ce/shipments', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Create a merchant shipment',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: createShipmentBodySchema,
                response: {
                    201: externalShipmentSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/shipments');
            const body = await deps.shipmentCompatibilityCommand.createShipment(ctx);
            return reply.status(201).send(body);
        });

        typed.get('/api/v2/ce/shipments/merchant', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'List merchant shipments',
                querystring: stockConnectCeOrdersQuerySchema,
                response: {
                    200: externalShipmentCollectionSchema,
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
                page: request.query.page,
                pageSize: request.query.pageSize,
            });
        });

        typed.get('/api/v2/ce/returns', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'List returns (StockConnect poll)',
                querystring: stockConnectCeOrdersQuerySchema,
                response: {
                    200: externalReturnCollectionSchema,
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
                page: request.query.page,
                pageSize: request.query.pageSize,
            });
        });

        typed.post('/api/v2/ce/returns/merchant', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Create a merchant return',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: createReturnBodySchema,
                response: {
                    201: externalReturnSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/returns/merchant');
            const body = await deps.returnCompatibilityCommand.createReturn(ctx);
            return reply.status(201).send(body);
        });

        typed.post('/api/v2/ce/returns/merchant/acknowledge', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Acknowledge a merchant return',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: acknowledgeReturnBodySchema,
                response: {
                    200: externalReturnMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/returns/merchant/acknowledge');
            const body = await deps.returnCompatibilityCommand.acknowledgeReturn(ctx);
            return reply.status(200).send(body);
        });

        typed.put('/api/v2/ce/returns', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Accept or reject a return',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: receiveReturnBodySchema,
                response: {
                    200: externalReturnMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    409: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'PUT /api/v2/ce/returns');
            const body = await deps.returnCompatibilityCommand.receiveReturn(ctx);
            return reply.status(200).send(body);
        });

        const ceMutationSuccessSchema = z.object({
            Success: z.literal(true),
            StatusCode: z.number().int(),
            Message: z.string().nullable().optional(),
            Content: z.unknown().optional(),
        });

        typed.get('/api/v2/ce/channels', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'List channels (StockConnect CE registry sync)',
                querystring: stockConnectCeApiKeyQuerySchema,
                response: {
                    200: z.object({
                        Success: z.literal(true),
                        StatusCode: z.literal(200),
                        Content: z.array(z.record(z.unknown())),
                        Count: z.number().int(),
                        TotalCount: z.number().int(),
                        ItemsPerPage: z.number().int(),
                    }),
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async () => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.stockConnectCeChannelCompatibilityQuery.listChannels({
                tenantId: actor.tenantId,
            });
        });

        typed.post('/api/v2/ce/products', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Push products (StockConnect CE PRODUCTS_PUSH)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.record(z.unknown())),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/products');
            return deps.stockConnectCeCatalogCommand.pushProducts(ctx);
        });

        typed.put('/api/v2/ce/offer/stock', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Update offer stock (StockConnect CE OFFER_STOCK)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.record(z.unknown())),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'PUT /api/v2/ce/offer/stock');
            return deps.stockConnectCeCatalogCommand.updateOfferStock(ctx);
        });

        typed.put('/api/v2/ce/offer', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Update offer price (StockConnect CE OFFER_PRICE)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.record(z.unknown())),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'PUT /api/v2/ce/offer');
            return deps.stockConnectCeCatalogCommand.updateOfferPrice(ctx);
        });

        typed.post('/api/v2/ce/products/freeze', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Freeze or unfreeze products (StockConnect CE PRODUCTS_FREEZE)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.record(z.unknown())),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/products/freeze');
            return deps.stockConnectCeCatalogCommand.freezeProducts(ctx);
        });

        typed.post('/api/v2/ce/products/bulkdelete', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Bulk delete products (StockConnect CE PRODUCTS_BULK_DELETE)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.union([z.string(), z.number()])),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'POST /api/v2/ce/products/bulkdelete');
            return deps.stockConnectCeCatalogCommand.bulkDeleteProducts(ctx);
        });

        typed.patch('/api/v2/ce/products/extra-data/bulk', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Patch product extra-data (StockConnect CE PRODUCTS_EXTRA_DATA)',
                querystring: stockConnectCeApiKeyQuerySchema,
                body: z.array(z.record(z.unknown())),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'PATCH /api/v2/ce/products/extra-data/bulk');
            return deps.stockConnectCeCatalogCommand.patchExtraData(ctx);
        });

        typed.put('/api/v2/ce/shipments/:merchantShipmentNo/delivery-state', {
            schema: {
                tags: ['StockConnect CE compatibility'],
                summary: 'Update shipment delivery state (StockConnect CE SHIPMENT_DELIVERY_STATE)',
                querystring: stockConnectCeApiKeyQuerySchema,
                params: z.object({
                    merchantShipmentNo: z.string().min(1).max(250),
                }),
                body: z.object({
                    Status: z.string().min(1),
                    DeliveredAt: z.union([z.string(), z.number(), z.null()]).optional(),
                }).passthrough(),
                response: {
                    200: ceMutationSuccessSchema,
                    400: externalErrorResponseSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    422: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceMutationRateLimit(deps);
            const ctx = stockConnectMutationContext(request, 'PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state');
            return deps.stockConnectCeShipmentDeliveryCommand.updateDeliveryState({
                ...ctx,
                merchantShipmentNo: request.params.merchantShipmentNo,
            });
        });
    });
};

export default stockconnectCeRoutes;
