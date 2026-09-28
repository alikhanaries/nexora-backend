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
import { externalErrorResponseSchema } from './compatibility-order.schemas.js';
import { stockConnectCeOrderCollectionSchema } from './stockconnect-ce-order.schemas.js';

const stockConnectCeOrdersQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    apiKey: z.string().optional(),
    apikey: z.string().optional(),
});

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
 * Additive surface — existing `/api/v2/*` contracts are unchanged.
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
    });
};

export default stockconnectCeRoutes;
