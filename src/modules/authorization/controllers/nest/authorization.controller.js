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
 */
export @Controller()
class AuthorizationController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.authorization.useCases;
  }

  @Get(AUTHORIZATION_ROUTES.listPermissions.path)
  async listPermissions() {
    const actor = requireActorContext();
    const permissions = await this.useCases.listPermissions.execute({
      actorPermissions: actor.permissions,
    });
    return { success: true, data: permissions.map(toPermissionResponse) };
  }

  @Get(AUTHORIZATION_ROUTES.listRoles.path)
  async listRoles() {
    const actor = requireActorContext();
    const roles = await this.useCases.listRoles.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: roles.map(toRoleResponse) };
  }

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
