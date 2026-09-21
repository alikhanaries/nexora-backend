import { requireActorContext } from '../../../shared/context/require-principal.js';
import { MarketplaceStatus } from '../domain/marketplace-status.js';
import { toMarketplaceResponse } from './marketplace.mapper.js';
import { createMarketplaceBodySchema, listMarketplacesQuerySchema, marketplaceIdParamsSchema, marketplaceListSuccessResponseSchema, marketplaceSuccessResponseSchema, updateMarketplaceBodySchema, } from './marketplace.schemas.js';
const marketplaceRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.get('/api/v1/marketplaces', {
        schema: {
            tags: ['Marketplaces'],
            summary: 'List global marketplace definitions',
            querystring: listMarketplacesQuerySchema,
            response: {
                200: marketplaceListSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { marketplaces } = await deps.listMarketplaces.execute({
            actorPermissions: actor.permissions,
            ...(request.query.status === undefined ? {} : { status: request.query.status }),
        });
        return {
            success: true,
            data: marketplaces.map(toMarketplaceResponse),
        };
    });
    typed.post('/api/v1/marketplaces', {
        schema: {
            tags: ['Marketplaces'],
            summary: 'Create a global marketplace definition',
            body: createMarketplaceBodySchema,
            response: {
                201: marketplaceSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const { marketplace } = await deps.createMarketplace.execute({
            actorPermissions: actor.permissions,
            key: request.body.key,
            name: request.body.name,
        });
        void reply.status(201);
        return {
            success: true,
            data: toMarketplaceResponse(marketplace),
        };
    });
    typed.get('/api/v1/marketplaces/:id', {
        schema: {
            tags: ['Marketplaces'],
            summary: 'Get a marketplace by id',
            params: marketplaceIdParamsSchema,
            response: {
                200: marketplaceSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { marketplace } = await deps.getMarketplace.execute({
            actorPermissions: actor.permissions,
            marketplaceId: request.params.id,
        });
        return {
            success: true,
            data: toMarketplaceResponse(marketplace),
        };
    });
    typed.patch('/api/v1/marketplaces/:id', {
        schema: {
            tags: ['Marketplaces'],
            summary: 'Update a marketplace',
            params: marketplaceIdParamsSchema,
            body: updateMarketplaceBodySchema,
            response: {
                200: marketplaceSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const actorId = actor.userId ?? actor.tenantId;
        let marketplace;
        if (request.body.name !== undefined) {
            ({ marketplace } = await deps.updateMarketplace.execute({
                actorPermissions: actor.permissions,
                marketplaceId: request.params.id,
                name: request.body.name,
            }));
        }
        else {
            ({ marketplace } = await deps.getMarketplace.execute({
                actorPermissions: actor.permissions,
                marketplaceId: request.params.id,
            }));
        }
        if (request.body.status !== undefined && request.body.status !== marketplace.status) {
            if (request.body.status === MarketplaceStatus.ACTIVE) {
                ({ marketplace } = await deps.activateMarketplace.execute({
                    actorPermissions: actor.permissions,
                    actorId,
                    actorTenantId: actor.tenantId,
                    marketplaceId: request.params.id,
                }));
            }
            else {
                ({ marketplace } = await deps.deactivateMarketplace.execute({
                    actorPermissions: actor.permissions,
                    actorId,
                    actorTenantId: actor.tenantId,
                    marketplaceId: request.params.id,
                }));
            }
        }
        return {
            success: true,
            data: toMarketplaceResponse(marketplace),
        };
    });
    await Promise.resolve();
};
export default marketplaceRoutes;
