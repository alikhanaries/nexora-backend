import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  createTenantBodySchema,
  tenantIdParamsSchema,
} from '../../views/tenant.schemas.js';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { Public } from '../../../../app/common/decorators/public.decorator.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { toTenantResponse } from '../../views/tenant.mapper.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { TENANT_ROUTES } from '../../routes/tenant.routes.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 * Business rules live in services/; paths live in routes/.
 */
export @Controller()
class TenantsController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.useCases = coreServices.tenants.useCases;
  }

  @Public()
  @Post(TENANT_ROUTES.create.path)
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createTenantBodySchema, body, 'create tenant');
    const { tenant } = await this.useCases.createTenant.execute(parsed);
    return { success: true, data: toTenantResponse(tenant) };
  }

  @Public()
  @Get(TENANT_ROUTES.getById.path)
  async getById(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const { tenant } = await this.useCases.getTenant.execute({ tenantId });
    return { success: true, data: toTenantResponse(tenant) };
  }

  @Post(TENANT_ROUTES.suspend.path)
  @HttpCode(200)
  async suspend(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const actor = requireActorContext();
    const { tenant } = await this.useCases.suspendTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: toTenantResponse(tenant) };
  }

  @Post(TENANT_ROUTES.reactivate.path)
  @HttpCode(200)
  async reactivate(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const actor = requireActorContext();
    const { tenant } = await this.useCases.reactivateTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: toTenantResponse(tenant) };
  }

  @Post(TENANT_ROUTES.close.path)
  @HttpCode(200)
  async close(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const actor = requireActorContext();
    const { tenant } = await this.useCases.closeTenant.execute({
      tenantId,
      actorTenantId: actor.tenantId,
      actorPermissions: actor.permissions,
    });
    return { success: true, data: toTenantResponse(tenant) };
  }
}
