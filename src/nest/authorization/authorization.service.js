import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

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

export @Injectable()
class AuthorizationService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  get useCases() {
    return this.coreDomain.authorization.routes.options;
  }

  async listPermissions() {
    const actor = requireActorContext();
    const permissions = await this.useCases.listPermissions.execute({
      actorPermissions: actor.permissions,
    });
    return permissions.map(toPermissionResponse);
  }

  async listRoles() {
    const actor = requireActorContext();
    const roles = await this.useCases.listRoles.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return roles.map(toRoleResponse);
  }

  async createRole(body) {
    const actor = requireActorContext();
    const role = await this.useCases.createRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      name: body.name,
      permissionKeys: body.permissionKeys,
    });
    return toRoleResponse(role);
  }

  async getEffectivePermissions(membershipId) {
    const actor = requireActorContext();
    const result = await this.useCases.getEffectivePermissions.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId,
    });
    return {
      membershipId: result.membershipId,
      permissions: [...result.permissions],
    };
  }

  async assignRole(membershipId, body) {
    const actor = requireActorContext();
    const role = await this.useCases.assignRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId,
      roleId: body.roleId,
    });
    return toRoleResponse(role);
  }

  async removeRole(membershipId, roleId) {
    const actor = requireActorContext();
    await this.useCases.removeRole.execute({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      membershipId,
      roleId,
    });
  }
}
