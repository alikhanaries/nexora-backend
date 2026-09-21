import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CloseTenant } from '../application/close-tenant.js';
import type { CreateTenant } from '../application/create-tenant.js';
import type { GetTenant } from '../application/get-tenant.js';
import type { ReactivateTenant } from '../application/reactivate-tenant.js';
import type { SuspendTenant } from '../application/suspend-tenant.js';
import { toTenantResponse } from './tenant.mapper.js';
import {
  createTenantBodySchema,
  tenantIdParamsSchema,
  tenantSuccessResponseSchema,
} from './tenant.schemas.js';

export interface TenantRoutesDependencies {
  readonly createTenant: CreateTenant;
  readonly getTenant: GetTenant;
  readonly suspendTenant: SuspendTenant;
  readonly reactivateTenant: ReactivateTenant;
  readonly closeTenant: CloseTenant;
}

const tenantRoutes: FastifyPluginAsync<TenantRoutesDependencies> = async (app, deps) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/v1/tenants',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Create a tenant',
        body: createTenantBodySchema,
        response: {
          201: tenantSuccessResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { tenant } = await deps.createTenant.execute(request.body);
      void reply.status(201);
      return {
        success: true as const,
        data: toTenantResponse(tenant),
      };
    },
  );

  typed.get(
    '/api/v1/tenants/:tenantId',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Get a tenant by id',
        params: tenantIdParamsSchema,
        response: {
          200: tenantSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const { tenant } = await deps.getTenant.execute({ tenantId: request.params.tenantId });
      return {
        success: true as const,
        data: toTenantResponse(tenant),
      };
    },
  );

  typed.post(
    '/api/v1/tenants/:tenantId/suspend',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Suspend an active tenant',
        params: tenantIdParamsSchema,
        response: {
          200: tenantSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const { tenant } = await deps.suspendTenant.execute({ tenantId: request.params.tenantId });
      return {
        success: true as const,
        data: toTenantResponse(tenant),
      };
    },
  );

  typed.post(
    '/api/v1/tenants/:tenantId/reactivate',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Reactivate a suspended tenant',
        params: tenantIdParamsSchema,
        response: {
          200: tenantSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const { tenant } = await deps.reactivateTenant.execute({
        tenantId: request.params.tenantId,
      });
      return {
        success: true as const,
        data: toTenantResponse(tenant),
      };
    },
  );

  typed.post(
    '/api/v1/tenants/:tenantId/close',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Close a tenant (terminal)',
        params: tenantIdParamsSchema,
        response: {
          200: tenantSuccessResponseSchema,
        },
      },
    },
    async (request) => {
      const { tenant } = await deps.closeTenant.execute({ tenantId: request.params.tenantId });
      return {
        success: true as const,
        data: toTenantResponse(tenant),
      };
    },
  );

  await Promise.resolve();
};

export default tenantRoutes;
