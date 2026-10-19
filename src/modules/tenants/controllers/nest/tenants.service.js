import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { toTenantResponse } from '../../views/tenant.mapper.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

export @Injectable()
class TenantsService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  async createTenant(body) {
    const { tenant } = await this.coreServices.tenants.useCases.createTenant.execute(body);
    return toTenantResponse(tenant);
  }

  async getTenant(tenantId) {
    const { tenant } = await this.coreServices.tenants.useCases.getTenant.execute({ tenantId });
    return toTenantResponse(tenant);
  }

  async suspendTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreServices.tenants.useCases.suspendTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }

  async reactivateTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreServices.tenants.useCases.reactivateTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }

  async closeTenant(tenantId) {
    const actor = requireActorContext();
    const { tenant } = await this.coreServices.tenants.useCases.closeTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return toTenantResponse(tenant);
  }
}
