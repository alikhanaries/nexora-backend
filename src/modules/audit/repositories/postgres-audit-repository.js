import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseOrThrow } from '../../../shared/validation/index.js';
import { reconstituteAuditEvent } from '../models/audit-event.js';
import { redactAuditMetadata } from '../services/redact-audit-metadata.js';

const auditRowSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid().nullable(),
    actor_kind: z.enum(['user', 'api-key', 'system']),
    actor_id: z.string().nullable(),
    event_type: z.string(),
    resource_type: z.string().nullable(),
    resource_id: z.string().nullable(),
    metadata: z.record(z.unknown()),
    ip_address: z.string().nullable(),
    request_id: z.string().nullable(),
    created_at: z.coerce.date(),
});

/**
 * Postgres persistence for the append-only audit log.
 * @returns {{ insert: Function, list: Function }}
 */
export function createPostgresAuditRepository() {
    return {
        /**
         * @param {object} tx
         * @param {object} event
         */
        async insert(tx, event) {
            const metadata = redactAuditMetadata(event.metadata);
            await tx.query(
                `INSERT INTO audit_log (
         id, tenant_id, actor_kind, actor_id, event_type,
         resource_type, resource_id, metadata, ip_address, request_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    randomUUID(),
                    event.tenantId ?? null,
                    event.actorKind,
                    event.actorId ?? null,
                    event.eventType,
                    event.resourceType ?? null,
                    event.resourceId ?? null,
                    JSON.stringify(metadata),
                    event.ipAddress ?? null,
                    event.requestId ?? null,
                ],
                { operation: 'audit.insert' },
            );
        },

        /**
         * @param {object} tx
         * @param {{ tenantId: string, eventType?: string, limit?: number, offset?: number }} input
         */
        async list(tx, input) {
            const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
            const offset = Math.max(input.offset ?? 0, 0);
            const conditions = ['tenant_id = $1'];
            const params = [input.tenantId];
            if (input.eventType !== undefined) {
                params.push(input.eventType);
                conditions.push(`event_type = $${params.length}`);
            }
            const where = conditions.join(' AND ');
            const countResult = await tx.query(
                `SELECT COUNT(*)::int AS total FROM audit_log WHERE ${where}`,
                params,
                { operation: 'audit.count' },
            );
            const total = Number(countResult.rows[0]?.['total'] ?? 0);
            const listParams = [...params, limit, offset];
            const result = await tx.query(
                `SELECT id, tenant_id, actor_kind, actor_id, event_type, resource_type,
              resource_id, metadata, ip_address, request_id, created_at
       FROM audit_log
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
                listParams,
                { operation: 'audit.list' },
            );
            return {
                total,
                events: result.rows.map((row) =>
                    reconstituteAuditEvent(parseOrThrow(auditRowSchema, row, 'audit row')),
                ),
            };
        },
    };
}
