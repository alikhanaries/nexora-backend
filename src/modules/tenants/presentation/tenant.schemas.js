import { z } from 'zod';
import { TenantStatus } from '../domain/tenant-status.js';
export const tenantIdParamsSchema = z.object({
    tenantId: z.string().uuid(),
});
export const createTenantBodySchema = z.object({
    slug: z.string().min(1).max(63),
    name: z.string().min(1).max(256),
});
export const tenantResponseSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    status: z.enum([TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CLOSED]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const tenantSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: tenantResponseSchema,
});
