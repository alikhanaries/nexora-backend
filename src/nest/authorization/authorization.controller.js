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
} from '../../modules/authorization/presentation/schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { AuthorizationService } from './authorization.service.js';

export @Controller()
class AuthorizationController {
  constructor(@Inject(AuthorizationService) authorizationService) {
    this.authorizationService = authorizationService;
  }

  @Get('/api/v1/permissions')
  async listPermissions() {
    const data = await this.authorizationService.listPermissions();
    return { success: true, data };
  }

  @Get('/api/v1/roles')
  async listRoles() {
    const data = await this.authorizationService.listRoles();
    return { success: true, data };
  }

  @Post('/api/v1/roles')
  @HttpCode(201)
  async createRole(@Body() body) {
    const parsed = parseOrThrow(createRoleBodySchema, body, 'create role');
    const data = await this.authorizationService.createRole(parsed);
    return { success: true, data };
  }

  @Get('/api/v1/memberships/:membershipId/roles')
  async getMembershipRoles(@Param() params) {
    const { membershipId } = parseOrThrow(membershipRoleParamsSchema, params, 'membership params');
    const data = await this.authorizationService.getEffectivePermissions(membershipId);
    return { success: true, data };
  }

  @Post('/api/v1/memberships/:membershipId/roles')
  @HttpCode(201)
  async assignRole(@Param() params, @Body() body) {
    const { membershipId } = parseOrThrow(membershipRoleParamsSchema, params, 'membership params');
    const parsed = parseOrThrow(assignRoleBodySchema, body, 'assign role');
    const data = await this.authorizationService.assignRole(membershipId, parsed);
    return { success: true, data };
  }

  @Delete('/api/v1/memberships/:membershipId/roles/:roleId')
  @HttpCode(200)
  async removeRole(@Param() params) {
    const parsed = parseOrThrow(removeMembershipRoleParamsSchema, params, 'remove role params');
    await this.authorizationService.removeRole(parsed.membershipId, parsed.roleId);
    return { success: true, data: { removed: true } };
  }
}
