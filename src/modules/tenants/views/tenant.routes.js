import { requireActorContext } from '../../../shared/context/require-principal.js';
import { toTenantResponse } from './tenant.mapper.js';
import { createTenantBodySchema, tenantIdParamsSchema, tenantSuccessResponseSchema, } from './tenant.schemas.js';
const tenantRoutes = async (app, deps) => {
    const typed = app.withTypeProvider();
    typed.post('/api/v1/tenants', {
        schema: {
            tags: ['Tenants'],
            summary: 'Create a tenant',
            body: createTenantBodySchema,
            response: {
                201: tenantSuccessResponseSchema,
            },
        },
    }, async (request, reply) => {
        const { tenant } = await deps.createTenant.execute(request.body);
        void reply.status(201);
        return {
            success: true,
            data: toTenantResponse(tenant),
        };
    });
    typed.get('/api/v1/tenants/:tenantId', {
        schema: {
            tags: ['Tenants'],
            summary: 'Get a tenant by id',
            params: tenantIdParamsSchema,
            response: {
                200: tenantSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const { tenant } = await deps.getTenant.execute({ tenantId: request.params.tenantId });
        return {
            success: true,
            data: toTenantResponse(tenant),
        };
    });
    typed.post('/api/v1/tenants/:tenantId/suspend', {
        schema: {
            tags: ['Tenants'],
            summary: 'Suspend an active tenant',
            params: tenantIdParamsSchema,
            response: {
                200: tenantSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { tenant } = await deps.suspendTenant.execute({
            tenantId: request.params.tenantId,
            actorTenantId: actor.tenantId,
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: toTenantResponse(tenant),
        };
    });
    typed.post('/api/v1/tenants/:tenantId/reactivate', {
        schema: {
            tags: ['Tenants'],
            summary: 'Reactivate a suspended tenant',
            params: tenantIdParamsSchema,
            response: {
                200: tenantSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { tenant } = await deps.reactivateTenant.execute({
            tenantId: request.params.tenantId,
            actorTenantId: actor.tenantId,
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: toTenantResponse(tenant),
        };
    });
    typed.post('/api/v1/tenants/:tenantId/close', {
        schema: {
            tags: ['Tenants'],
            summary: 'Close a tenant (terminal)',
            params: tenantIdParamsSchema,
            response: {
                200: tenantSuccessResponseSchema,
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const { tenant } = await deps.closeTenant.execute({
            tenantId: request.params.tenantId,
            actorTenantId: actor.tenantId,
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: toTenantResponse(tenant),
        };
    });
    await Promise.resolve();
};
export default tenantRoutes;
