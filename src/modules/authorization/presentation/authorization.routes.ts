import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AssignRole } from '../application/assign-role.js';
import type { CreateRole } from '../application/create-role.js';
import type { GetEffectivePermissions } from '../application/get-effective-permissions.js';
import type { ListPermissions } from '../application/list-permissions.js';
import type { ListRoles } from '../application/list-roles.js';
import type { RemoveRole } from '../application/remove-role.js';
import {
  assignRoleBodySchema,
  createRoleBodySchema,
  effectivePermissionsResponseSchema,
  membershipRoleParamsSchema,
  permissionResponseSchema,
  removeMembershipRoleParamsSchema,
  roleResponseSchema,
  successEnvelope,
} from './schemas.js';
import { requireActorContext } from './request-context.js';

export interface AuthorizationRoutesOptions {
  readonly createRole: CreateRole;
  readonly listRoles: ListRoles;
  readonly assignRole: AssignRole;
  readonly removeRole: RemoveRole;
  readonly listPermissions: ListPermissions;
  readonly getEffectivePermissions: GetEffectivePermissions;
}

function toRoleResponse(role: {
  id: string;
  tenantId: string;
  name: string;
  systemKey: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isSystem: boolean;
  permissionKeys: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}) {
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

function toPermissionResponse(permission: {
  id: string;
  key: string;
  description: string;
  createdAt: Date;
}) {
  return {
    id: permission.id,
    key: permission.key,
    description: permission.description,
    createdAt: permission.createdAt.toISOString(),
  };
}

const authorizationRoutes: FastifyPluginAsync<AuthorizationRoutesOptions> = async (
  app,
  options,
) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/api/v1/permissions',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'List the global permission catalog',
        response: {
          200: successEnvelope(z.array(permissionResponseSchema)),
        },
      },
    },
    async () => {
      const actor = requireActorContext();
      const permissions = await options.listPermissions.execute({
        actorPermissions: actor.permissions,
      });

      return {
        success: true as const,
        data: permissions.map(toPermissionResponse),
      };
    },
  );

  typed.get(
    '/api/v1/roles',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'List tenant roles',
        response: {
          200: successEnvelope(z.array(roleResponseSchema)),
        },
      },
    },
    async () => {
      const actor = requireActorContext();
      const roles = await options.listRoles.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
      });

      return {
        success: true as const,
        data: roles.map(toRoleResponse),
      };
    },
  );

  typed.post(
    '/api/v1/roles',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'Create a custom tenant role',
        body: createRoleBodySchema,
        response: {
          201: successEnvelope(roleResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const role = await options.createRole.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        name: request.body.name,
        permissionKeys: request.body.permissionKeys,
      });

      return reply.status(201).send({
        success: true as const,
        data: toRoleResponse(role),
      });
    },
  );

  typed.get(
    '/api/v1/memberships/:membershipId/roles',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'Get effective permissions for a membership',
        params: membershipRoleParamsSchema,
        response: {
          200: successEnvelope(effectivePermissionsResponseSchema),
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      const result = await options.getEffectivePermissions.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        membershipId: request.params.membershipId,
      });

      return {
        success: true as const,
        data: {
          membershipId: result.membershipId,
          permissions: [...result.permissions],
        },
      };
    },
  );

  typed.post(
    '/api/v1/memberships/:membershipId/roles',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'Assign a role to a membership',
        params: membershipRoleParamsSchema,
        body: assignRoleBodySchema,
        response: {
          201: successEnvelope(roleResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const actor = requireActorContext();
      const role = await options.assignRole.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        membershipId: request.params.membershipId,
        roleId: request.body.roleId,
      });

      return reply.status(201).send({
        success: true as const,
        data: toRoleResponse(role),
      });
    },
  );

  typed.delete(
    '/api/v1/memberships/:membershipId/roles/:roleId',
    {
      schema: {
        tags: ['Authorization'],
        summary: 'Remove a role from a membership',
        params: removeMembershipRoleParamsSchema,
        response: {
          200: successEnvelope(z.object({ removed: z.literal(true) })),
        },
      },
    },
    async (request) => {
      const actor = requireActorContext();
      await options.removeRole.execute({
        tenantId: actor.tenantId,
        actorPermissions: actor.permissions,
        membershipId: request.params.membershipId,
        roleId: request.params.roleId,
      });

      return {
        success: true as const,
        data: { removed: true as const },
      };
    },
  );

  await Promise.resolve();
};

export default authorizationRoutes;
