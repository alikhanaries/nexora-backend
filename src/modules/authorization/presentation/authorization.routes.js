import { z } from 'zod';
import { assignRoleBodySchema, createRoleBodySchema, effectivePermissionsResponseSchema, membershipRoleParamsSchema, permissionResponseSchema, removeMembershipRoleParamsSchema, roleResponseSchema, successEnvelope, } from './schemas.js';
import { requireActorContext } from './request-context.js';
function toRoleResponse(role) {
    return {
        id: role.id,
        tenantId: role.tenantId,
        name: role.name,
        systemKey: role.systemKey,
        status: role.status,
        isSystem: role.isSystem,
        permissionKeys: [...role.permissionKeys],
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
    };
}
function toPermissionResponse(permission) {
    return {
        id: permission.id,
        key: permission.key,
        description: permission.description,
        createdAt: permission.createdAt.toISOString(),
    };
}
const authorizationRoutes = async (app, options) => {
    const typed = app.withTypeProvider();
    typed.get('/api/v1/permissions', {
        schema: {
            tags: ['Authorization'],
            summary: 'List the global permission catalog',
            response: {
                200: successEnvelope(z.array(permissionResponseSchema)),
            },
        },
    }, async () => {
        const actor = requireActorContext();
        const permissions = await options.listPermissions.execute({
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: permissions.map(toPermissionResponse),
        };
    });
    typed.get('/api/v1/roles', {
        schema: {
            tags: ['Authorization'],
            summary: 'List tenant roles',
            response: {
                200: successEnvelope(z.array(roleResponseSchema)),
            },
        },
    }, async () => {
        const actor = requireActorContext();
        const roles = await options.listRoles.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
        });
        return {
            success: true,
            data: roles.map(toRoleResponse),
        };
    });
    typed.post('/api/v1/roles', {
        schema: {
            tags: ['Authorization'],
            summary: 'Create a custom tenant role',
            body: createRoleBodySchema,
            response: {
                201: successEnvelope(roleResponseSchema),
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const role = await options.createRole.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            name: request.body.name,
            permissionKeys: request.body.permissionKeys,
        });
        return reply.status(201).send({
            success: true,
            data: toRoleResponse(role),
        });
    });
    typed.get('/api/v1/memberships/:membershipId/roles', {
        schema: {
            tags: ['Authorization'],
            summary: 'Get effective permissions for a membership',
            params: membershipRoleParamsSchema,
            response: {
                200: successEnvelope(effectivePermissionsResponseSchema),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const result = await options.getEffectivePermissions.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            membershipId: request.params.membershipId,
        });
        return {
            success: true,
            data: {
                membershipId: result.membershipId,
                permissions: [...result.permissions],
            },
        };
    });
    typed.post('/api/v1/memberships/:membershipId/roles', {
        schema: {
            tags: ['Authorization'],
            summary: 'Assign a role to a membership',
            params: membershipRoleParamsSchema,
            body: assignRoleBodySchema,
            response: {
                201: successEnvelope(roleResponseSchema),
            },
        },
    }, async (request, reply) => {
        const actor = requireActorContext();
        const role = await options.assignRole.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            membershipId: request.params.membershipId,
            roleId: request.body.roleId,
        });
        return reply.status(201).send({
            success: true,
            data: toRoleResponse(role),
        });
    });
    typed.delete('/api/v1/memberships/:membershipId/roles/:roleId', {
        schema: {
            tags: ['Authorization'],
            summary: 'Remove a role from a membership',
            params: removeMembershipRoleParamsSchema,
            response: {
                200: successEnvelope(z.object({ removed: z.literal(true) })),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        await options.removeRole.execute({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            membershipId: request.params.membershipId,
            roleId: request.params.roleId,
        });
        return {
            success: true,
            data: { removed: true },
        };
    });
    await Promise.resolve();
};
export default authorizationRoutes;
