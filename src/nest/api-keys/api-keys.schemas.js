import { z } from 'zod';

export const createApiKeyBodySchema = z.object({
  name: z.string().min(1).max(128),
  scopes: z.array(z.string().min(1)).min(1),
  keyType: z.enum(['STANDARD', 'INTEGRATION']).optional(),
  expiresAt: z.string().optional(),
});

export const apiKeyIdParamsSchema = z.object({
  apiKeyId: z.string().uuid(),
});
