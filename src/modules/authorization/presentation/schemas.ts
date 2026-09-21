import { z } from 'zod';

export const permissionResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  description: z.string(),
  createdAt: z.string().datetime(),
});

export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  systemKey: z.string().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  isSystem: z.boolean(),
  permissionKeys: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createRoleBodySchema = z.object({
  name: z.string().trim().min(1).max(128),
  permissionKeys: z.array(z.string().min(1)).min(1),
});

export const assignRoleBodySchema = z.object({
  roleId: z.string().uuid(),
});

export const membershipRoleParamsSchema = z.object({
  membershipId: z.string().uuid(),
});

export const removeMembershipRoleParamsSchema = z.object({
  membershipId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const effectivePermissionsResponseSchema = z.object({
  membershipId: z.string().uuid(),
  permissions: z.array(z.string()),
});

export const successEnvelope = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });
