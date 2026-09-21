import type { Tenant } from '../domain/tenant.js';
import type { z } from 'zod';
import type { tenantResponseSchema } from './tenant.schemas.js';

export type TenantResponse = z.infer<typeof tenantResponseSchema>;

export function toTenantResponse(tenant: Tenant): TenantResponse {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}
