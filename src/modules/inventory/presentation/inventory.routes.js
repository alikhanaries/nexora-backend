import { z } from 'zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { withCommerceMetric } from '../../../shared/metrics/record-commerce-operation.js';
import { optionalReferenceFields } from '../application/optional-fields.js';
import { toBalanceResponse, toBalanceSnapshotResponse, toStockLocationResponse, } from './inventory.mapper.js';
import { adjustInventoryBodySchema, balanceResponseSchema, createStockLocationBodySchema, inventoryListQuerySchema, mutationResultSchema, productIdParamsSchema, receiveInventoryBodySchema, releaseInventoryBodySchema, reserveInventoryBodySchema, reserveResultSchema, stockLocationIdParamsSchema, stockLocationResponseSchema, } from './inventory.schemas.js';
const inventoryRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.get('/api/v1/stock-locations', {
        schema: {
            tags: ['Inventory'],
            summary: 'List stock locations for the current tenant',
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.array(stockLocationResponseSchema),
                }),
            },
        },
    }, async () => {
        const actor = requireActorContext();
        const { locations } = await deps.listStockLocations.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: locations.map(toStockLocationResponse),
        };
    });
    typed.post('/api/v1/stock-locations', {
        schema: {
            tags: ['Inventory'],
            summary: 'Create a stock location',
            body: createStockLocationBodySchema,
            response: {
                201: z.object({
                    success: z.literal(true),
                    data: stockLocationResponseSchema,
                }),
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const { location } = await deps.createStockLocation.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(actor.userId === undefined ? {} : { actorId: actor.userId }),
            name: request.body.name,
            ...(request.body.externalReference === undefined
                ? {}
                : { externalReference: request.body.externalReference }),
        });
        void reply.status(201);
        return {
            success: true,
            data: toStockLocationResponse(location),
        };
    });
    typed.get('/api/v1/stock-locations/:stockLocationId', {
        schema: {
            tags: ['Inventory'],
            summary: 'Get a stock location by id',
            params: stockLocationIdParamsSchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: stockLocationResponseSchema,
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { location } = await deps.getStockLocation.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            stockLocationId: request.params.stockLocationId,
        });
        return {
            success: true,
            data: toStockLocationResponse(location),
        };
    });
    typed.get('/api/v1/inventory', {
        schema: {
            tags: ['Inventory'],
            summary: 'List inventory balances for the current tenant',
            querystring: inventoryListQuerySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.array(balanceResponseSchema),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { balances } = await deps.getInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(request.query.stockLocationId === undefined
                ? {}
                : { stockLocationId: request.query.stockLocationId }),
        });
        return {
            success: true,
            data: balances.map(toBalanceResponse),
        };
    });
    typed.get('/api/v1/inventory/:productId', {
        schema: {
            tags: ['Inventory'],
            summary: 'Get inventory balances for a product',
            params: productIdParamsSchema,
            querystring: inventoryListQuerySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: z.array(balanceResponseSchema),
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { balances } = await deps.getInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            productId: request.params.productId,
            ...(request.query.stockLocationId === undefined
                ? {}
                : { stockLocationId: request.query.stockLocationId }),
        });
        return {
            success: true,
            data: balances.map(toBalanceResponse),
        };
    });
    typed.post('/api/v1/inventory/adjustments', {
        schema: {
            tags: ['Inventory'],
            summary: 'Adjust inventory quantities',
            body: adjustInventoryBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: mutationResultSchema,
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const result = await withCommerceMetric(deps.metrics, 'inventory.adjust', () => deps.adjustInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            stockLocationId: request.body.stockLocationId,
            productId: request.body.productId,
            delta: request.body.delta,
            ...optionalReferenceFields(request.body),
        }));
        return {
            success: true,
            data: {
                idempotent: result.idempotent,
                balance: toBalanceSnapshotResponse(result.balance),
            },
        };
    });
    typed.post('/api/v1/inventory/receipts', {
        schema: {
            tags: ['Inventory'],
            summary: 'Receive inventory into a stock location',
            body: receiveInventoryBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: mutationResultSchema,
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const result = await withCommerceMetric(deps.metrics, 'inventory.receive', () => deps.receiveInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            stockLocationId: request.body.stockLocationId,
            productId: request.body.productId,
            quantity: request.body.quantity,
            ...optionalReferenceFields(request.body),
        }));
        return {
            success: true,
            data: {
                idempotent: result.idempotent,
                balance: toBalanceSnapshotResponse(result.balance),
            },
        };
    });
    typed.post('/api/v1/inventory/reservations', {
        schema: {
            tags: ['Inventory'],
            summary: 'Reserve inventory for a business reference',
            body: reserveInventoryBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: reserveResultSchema,
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const result = await withCommerceMetric(deps.metrics, 'inventory.reserve', () => deps.reserveInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            stockLocationId: request.body.stockLocationId,
            productId: request.body.productId,
            quantity: request.body.quantity,
            referenceType: request.body.referenceType,
            referenceId: request.body.referenceId,
            ...optionalReferenceFields({ idempotencyKey: request.body.idempotencyKey }),
        }));
        return {
            success: true,
            data: {
                reservationId: result.reservationId,
                idempotent: result.idempotent,
                balance: toBalanceSnapshotResponse(result.balance),
            },
        };
    });
    typed.post('/api/v1/inventory/releases', {
        schema: {
            tags: ['Inventory'],
            summary: 'Release a prior inventory reservation',
            body: releaseInventoryBodySchema,
            response: {
                200: z.object({
                    success: z.literal(true),
                    data: reserveResultSchema,
                }),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const result = await withCommerceMetric(deps.metrics, 'inventory.release', () => deps.releaseInventory.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            stockLocationId: request.body.stockLocationId,
            productId: request.body.productId,
            referenceType: request.body.referenceType,
            referenceId: request.body.referenceId,
            ...(request.body.quantity === undefined ? {} : { quantity: request.body.quantity }),
            ...optionalReferenceFields({ idempotencyKey: request.body.idempotencyKey }),
        }));
        return {
            success: true,
            data: {
                reservationId: result.reservationId,
                idempotent: result.idempotent,
                balance: toBalanceSnapshotResponse(result.balance),
            },
        };
    });
    await Promise.resolve();
};
export default inventoryRoutes;
