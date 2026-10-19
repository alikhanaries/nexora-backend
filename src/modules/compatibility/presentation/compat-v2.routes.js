import { z } from 'zod';
import { COMPATIBILITY_RATE_LIMIT_POLICIES } from '../../../shared/auth/rate-limit-policies.js';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { RateLimitError } from '../../../shared/errors/index.js';
import { actorFingerprint } from '../../../shared/http/actor-fingerprint.js';
import { enforceCompatibilityRateLimit } from '../application/enforce-compatibility-rate-limit.js';
import { mapCoreErrorToExternalApiResponse } from '../application/errors/map-core-error.js';
import {
    resolveCompatV2IdempotencyKey,
    stableIdempotencyFingerprint,
} from '../application/resolve-compat-v2-idempotency-key.js';
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
import { compatV2OrderCollectionSchema } from './compat-v2-order.schemas.js';
import { ValidationError } from '../../../shared/errors/index.js';

const compatV2OrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    apiKey: z.string().optional(),
    apikey: z.string().optional(),
});

const compatV2ApiKeyQuerySchema = z.object({
    apiKey: z.string().optional(),
    apikey: z.string().optional(),
});

const compatV2ProductsQuerySchema = compatV2ApiKeyQuerySchema.extend({
    merchantProductNoList: z.union([z.string(), z.array(z.string())]).optional(),
    MerchantProductNoList: z.union([z.string(), z.array(z.string())]).optional(),
});

function readMerchantProductNosFromQuery(query) {
    const raw = query.merchantProductNoList ?? query.MerchantProductNoList ?? [];
    return (Array.isArray(raw) ? raw : [raw]).filter((value) => typeof value === 'string' && value.length > 0);
}

function compatV2MutationContext(request, routeId) {
    const actor = requireActorContext();
    const actorId = actor.userId ?? actor.apiKeyId ?? actor.tenantId;
    const actorKind = actor.userId !== undefined ? 'user' : 'api-key';
    return {
        tenantId: actor.tenantId,
        actorId,
        actorKind,
        actorPermissions: actor.permissions,
        principalFingerprint: actorFingerprint(actor),
        idempotencyKey: resolveCompatV2IdempotencyKey({
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
 * Public compat v2 routes (`/api/v2/ce/*`) for StockConnect consumers.
 * Additive surface ΓÇö existing `/api/v2/*` contracts are unchanged.
 */
const compatV2Routes = async (app, deps) => {
    await app.register(async (ceApp) => {
        ceApp.setErrorHandler((error, request, reply) => {
            const mapped = mapCoreErrorToExternalApiResponse(error);
            if (error instanceof RateLimitError) {
                reply.header('retry-after', String(error.retryAfterSeconds));
            }
            void reply.status(mapped.statusCode).send(mapped.body);
        });
        const typed = ceApp.withTypeProvider();

        typed.get('/api/v2/ce/orders/:merchantOrderNo/invoice', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Download order invoice PDF (merchant protocol)',
                description: 'Sales tax invoice PDF for ParseInvoice and invoice upload flows (public `/api/v2/ce/*` contract).',
                params: z.object({
                    merchantOrderNo: z.string().min(1).max(250),
                }),
                querystring: compatV2ApiKeyQuerySchema,
                response: {
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request, reply) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            const invoice = await deps.compatV2OrderInvoiceQuery.getOrderInvoice({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                merchantOrderNo: request.params.merchantOrderNo,
            });
            reply.serializer((payload) => payload);
            return reply
                .header('content-type', invoice.contentType)
                .header('content-disposition', `inline; filename="invoice-${request.params.merchantOrderNo}.pdf"`)
                .send(invoice.body);
        });

        typed.get('/api/v2/ce/orders', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'List orders (merchant protocol poll)',
                description: 'Order list for StockConnect polling (`page`, `pageSize`, query `apiKey`). '
                    + 'Does not replace GET /api/v2/orders or GET /api/v2/orders/new.',
                querystring: compatV2OrdersQuerySchema,
                response: {
                    200: compatV2OrderCollectionSchema,
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.compatV2OrderQuery.listOrdersForCompatV2Poll({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                page: request.query.page,
                pageSize: request.query.pageSize,
            });
        });

        typed.post('/api/v2/ce/orders/acknowledge', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Acknowledge an order (merchant protocol)',
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
            const idempotencyKey = resolveCompatV2IdempotencyKey({
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
                tags: ['Merchant protocol compatibility'],
                summary: 'Create a merchant cancellation',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/cancellations');
            const body = await deps.cancellationCompatibilityCommand.createCancellation(ctx);
            return reply.status(201).send(body);
        });

        typed.post('/api/v2/ce/shipments', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Create a merchant shipment',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/shipments');
            const body = await deps.shipmentCompatibilityCommand.createShipment(ctx);
            return reply.status(201).send(body);
        });

        typed.get('/api/v2/ce/shipments/merchant', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'List merchant shipments',
                querystring: compatV2OrdersQuerySchema,
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
                tags: ['Merchant protocol compatibility'],
                summary: 'List returns (StockConnect poll)',
                querystring: compatV2OrdersQuerySchema,
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
                tags: ['Merchant protocol compatibility'],
                summary: 'Create a merchant return',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/returns/merchant');
            const body = await deps.returnCompatibilityCommand.createReturn(ctx);
            return reply.status(201).send(body);
        });

        typed.post('/api/v2/ce/returns/merchant/acknowledge', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Acknowledge a merchant return',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/returns/merchant/acknowledge');
            const body = await deps.returnCompatibilityCommand.acknowledgeReturn(ctx);
            return reply.status(200).send(body);
        });

        typed.put('/api/v2/ce/returns', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Accept or reject a return',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'PUT /api/v2/ce/returns');
            const body = await deps.returnCompatibilityCommand.receiveReturn(ctx);
            return reply.status(200).send(body);
        });

        const ceMutationSuccessSchema = z.object({
            Success: z.literal(true),
            StatusCode: z.number().int(),
            Message: z.string().nullable().optional(),
            Content: z.unknown().optional(),
        });

        typed.get('/api/v2/ce/products', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'List products by merchant SKU (Merchant protocol GET products)',
                description: 'Same contract as GET /api/v2/products with CE query `apiKey` auth. '
                    + 'StockConnect `getExistingProductsBySkuFromCE` uses repeated `merchantProductNoList` query params.',
                querystring: compatV2ProductsQuerySchema,
                response: {
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            const merchantProductNos = readMerchantProductNosFromQuery(request.query);
            if (merchantProductNos.length === 0) {
                throw new ValidationError('merchantProductNoList is required');
            }
            return deps.compatV2ProductsQuery.listProductsByMerchantProductNos({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                merchantProductNos,
            });
        });

        typed.get('/api/v2/ce/channels/:channelId/products', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'List channel listing status by SKU (StockConnect productSyncService)',
                querystring: compatV2ApiKeyQuerySchema.extend({
                    page: z.coerce.number().int().min(1).optional(),
                    pageSize: z.coerce.number().int().min(1).max(250).optional(),
                }),
                params: z.object({
                    channelId: z.coerce.number().int().positive(),
                }),
                response: {
                    401: externalErrorResponseSchema,
                    403: externalErrorResponseSchema,
                    404: externalErrorResponseSchema,
                    500: externalErrorResponseSchema,
                },
            },
        }, async (request) => {
            await enforceReadRateLimit(deps);
            const actor = requireActorContext();
            return deps.compatV2IntegrationProductsQuery.listChannelProducts({
                tenantId: actor.tenantId,
                actorPermissions: actor.permissions,
                ceChannelId: request.params.channelId,
                page: request.query.page,
                pageSize: request.query.pageSize,
            });
        });

        typed.get('/api/v2/ce/channels', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'List channels (Merchant protocol registry sync)',
                querystring: compatV2ApiKeyQuerySchema,
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
            return deps.compatV2IntegrationListQuery.listCommerceIntegrations({
                tenantId: actor.tenantId,
            });
        });

        typed.post('/api/v2/ce/products', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Push products (Merchant protocol PRODUCTS_PUSH)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/products');
            return deps.compatV2CatalogCommand.pushProducts(ctx);
        });

        typed.put('/api/v2/ce/offer/stock', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Update offer stock (Merchant protocol OFFER_STOCK)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'PUT /api/v2/ce/offer/stock');
            return deps.compatV2CatalogCommand.updateOfferStock(ctx);
        });

        typed.put('/api/v2/ce/offer', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Update offer price (Merchant protocol OFFER_PRICE)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'PUT /api/v2/ce/offer');
            return deps.compatV2CatalogCommand.updateOfferPrice(ctx);
        });

        typed.post('/api/v2/ce/products/freeze', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Freeze or unfreeze products (Merchant protocol PRODUCTS_FREEZE)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/products/freeze');
            return deps.compatV2CatalogCommand.freezeProducts(ctx);
        });

        typed.post('/api/v2/ce/products/bulkdelete', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Bulk delete products (Merchant protocol PRODUCTS_BULK_DELETE)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'POST /api/v2/ce/products/bulkdelete');
            return deps.compatV2CatalogCommand.bulkDeleteProducts(ctx);
        });

        typed.patch('/api/v2/ce/products/extra-data/bulk', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Patch product extra-data (Merchant protocol PRODUCTS_EXTRA_DATA)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'PATCH /api/v2/ce/products/extra-data/bulk');
            return deps.compatV2CatalogCommand.patchExtraData(ctx);
        });

        typed.put('/api/v2/ce/shipments/:merchantShipmentNo/delivery-state', {
            schema: {
                tags: ['Merchant protocol compatibility'],
                summary: 'Update shipment delivery state (Merchant protocol SHIPMENT_DELIVERY_STATE)',
                querystring: compatV2ApiKeyQuerySchema,
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
            const ctx = compatV2MutationContext(request, 'PUT /api/v2/ce/shipments/:merchantShipmentNo/delivery-state');
            return deps.compatV2ShipmentDeliveryCommand.updateDeliveryState({
                ...ctx,
                merchantShipmentNo: request.params.merchantShipmentNo,
            });
        });
    });
};

export default compatV2Routes;
