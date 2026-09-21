import { z } from 'zod';
import { AUDIT_EVENT_TYPES } from '../domain/audit-event.js';

export const auditEventResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  actorKind: z.enum(['user', 'api-key', 'system']),
  actorId: z.string().nullable(),
  eventType: z.enum(AUDIT_EVENT_TYPES),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  metadata: z.object({}).passthrough(),
  ipAddress: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.string(),
});

export const listAuditQuerySchema = z.object({
  eventType: z.enum(AUDIT_EVENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function successEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}
