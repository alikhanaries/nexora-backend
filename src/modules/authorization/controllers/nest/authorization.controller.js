import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  assignRoleBodySchema,
  createRoleBodySchema,
  membershipRoleParamsSchema,
  removeMembershipRoleParamsSchema,
} from '../../views/schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { AUTHORIZATION_ROUTES } from '../../routes/authorization.routes.js';
import { toPermissionResponse, toRoleResponse } from '../../views/authorization.mapper.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 * Routes under `/api/v1/permissions`, `/api/v1/roles`, `/api/v1/memberships/*` (AUTHORIZATION_ROUTES); handlers call `CORE_SERVICES.authorization.useCases`.
 */
@Controller()
class AuthorizationController {
  /** @param {object} coreServices Injected Wasl core services (`authorization.useCases`). */
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.authorization.useCases;
  }

  /**
   * Lists the global permission catalog keys the caller may view.
   * Authz: `permissions.read` in use case.
   * @returns {Promise<{ success: true, data: object[] }>}
   */
  @Get(AUTHORIZATION_ROUTES.listPermissions.path)
  async listPermissions() {
    const actor = requireActorContext();
    const permissions = await this.useCases.listPermissions.execute({
      actorPermissions: actor.permissions,
    });
    return { success: true, data: permissions.map(toPermissionResponse) };
  }

  /**
   * Lists tenant roles with permission keys.
   * Authz: `roles.read`. Tenant: actor context.
   * @returns {Promise<{ success: true, data: object[] }>}
   */
  @Get(AUTHORIZATION_ROUTES.listRoles.path)
  async listRoles() {
    const actor = requireActorContext();
    const roles = await this.useCases.listRoles.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: roles.map(toRoleResponse) };
  }

  /**
   * Creates a custom tenant role with selected permission keys.
   * Authz: `roles.manage`. Tenant: actor context.
   * @returns {Promise<{ success: true, data: object }>}
   */
  @Post(AUTHORIZATION_ROUTES.createRole.path)
  @HttpCode(201)
  async createRole(@Body() body) {
    const parsed = parseOrThrow(createRoleBodySchema, body, 'create role');
    const actor = requireActorContext();
    const role = await this.useCases.createRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      name: parsed.name,
      permissionKeys: parsed.permissionKeys,
    });
    return { success: true, data: toRoleResponse(role) };
  }

  /**
   * Effective permission set for a membership (union of active role grants).
   * Authz: `roles.read`. Tenant: actor context; membership must belong to tenant.
   * @returns {Promise<{ success: true, data: { membershipId: string, permissions: string[] } }>}
   */
  @Get(AUTHORIZATION_ROUTES.getMembershipRoles.path)
  async getMembershipRoles(@Param() params) {
    const { membershipId } = parseOrThrow(membershipRoleParamsSchema, params, 'membership params');
    const actor = requireActorContext();
    const result = await this.useCases.getEffectivePermissions.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId,
    });
    return {
      success: true,
      data: {
        membershipId: result.membershipId,
        permissions: [...result.permissions],
      },
    };
  }

  /**
   * Assigns a tenant role to a membership.
   * Authz: `roles.manage`. Tenant: actor context. Idempotent conflict if already assigned.
   * @returns {Promise<{ success: true, data: object }>}
   */
  @Post(AUTHORIZATION_ROUTES.assignRole.path)
  @HttpCode(201)
  async assignRole(@Param() params, @Body() body) {
    const { membershipId } = parseOrThrow(membershipRoleParamsSchema, params, 'membership params');
    const parsed = parseOrThrow(assignRoleBodySchema, body, 'assign role');
    const actor = requireActorContext();
    const role = await this.useCases.assignRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId,
      roleId: parsed.roleId,
    });
    return { success: true, data: toRoleResponse(role) };
  }

  /**
   * Removes a role assignment from a membership (last-admin guard in use case).
   * Authz: `roles.manage`. Tenant: actor context.
   * @returns {Promise<{ success: true, data: { removed: true } }>}
   */
  @Delete(AUTHORIZATION_ROUTES.removeRole.path)
  @HttpCode(200)
  async removeRole(@Param() params) {
    const parsed = parseOrThrow(removeMembershipRoleParamsSchema, params, 'remove role params');
    const actor = requireActorContext();
    await this.useCases.removeRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId: parsed.membershipId,
      roleId: parsed.roleId,
    });
    return { success: true, data: { removed: true } };
  }
}
export { AuthorizationController };
