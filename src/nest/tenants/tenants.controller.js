import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  createTenantBodySchema,
  tenantIdParamsSchema,
} from '../../modules/tenants/presentation/tenant.schemas.js';
import { parseOrThrow } from '../../shared/validation/index.js';
import { Public } from '../common/decorators/public.decorator.js';
import { TenantsService } from './tenants.service.js';

export @Controller()
class TenantsController {
  constructor(@Inject(TenantsService) tenantsService) {
    this.tenantsService = tenantsService;
  }

  @Public()
  @Post('/api/v1/tenants')
  @HttpCode(201)
  async create(@Body() body) {
    const parsed = parseOrThrow(createTenantBodySchema, body, 'create tenant');
    const data = await this.tenantsService.createTenant(parsed);
    return { success: true, data };
  }

  @Public()
  @Get('/api/v1/tenants/:tenantId')
  async getById(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const data = await this.tenantsService.getTenant(tenantId);
    return { success: true, data };
  }

  @Post('/api/v1/tenants/:tenantId/suspend')
  @HttpCode(200)
  async suspend(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const data = await this.tenantsService.suspendTenant(tenantId);
    return { success: true, data };
  }

  @Post('/api/v1/tenants/:tenantId/reactivate')
  @HttpCode(200)
  async reactivate(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const data = await this.tenantsService.reactivateTenant(tenantId);
    return { success: true, data };
  }

  @Post('/api/v1/tenants/:tenantId/close')
  @HttpCode(200)
  async close(@Param() params) {
    const { tenantId } = parseOrThrow(tenantIdParamsSchema, params, 'tenant params');
    const data = await this.tenantsService.closeTenant(tenantId);
    return { success: true, data };
  }
}
