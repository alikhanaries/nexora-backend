import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { toTenantResponse } from '../../modules/tenants/presentation/tenant.mapper.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class TenantsService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  async createTenant(body) {
    const { tenant } = await this.coreDomain.tenants.useCases.createTenant.execute(body);
    return toTenantResponse(tenant);
  }

  async getTenant(tenantId) {
    const { tenant } = await this.coreDomain.tenants.useCases.getTenant.execute({ tenantId });
    return toTenantResponse(tenant);
  }

  async suspendTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreDomain.tenants.useCases.suspendTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }

  async reactivateTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreDomain.tenants.useCases.reactivateTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }

  async closeTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreDomain.tenants.useCases.closeTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }
}
