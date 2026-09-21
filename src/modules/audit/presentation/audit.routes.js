import { z } from 'zod';
import { requireActorContext } from '../../../shared/context/require-principal.js';
import { auditEventResponseSchema, listAuditQuerySchema, successEnvelope } from './schemas.js';
const auditRoutes = async (app, options) => {
    const typed = app.withTypeProvider();
    typed.get('/api/v1/audit', {
        schema: {
            tags: ['Audit'],
            summary: 'List security audit events for the current tenant',
            response: {
                200: successEnvelope(z.object({
                    events: z.array(auditEventResponseSchema),
                    total: z.number().int(),
                })),
            },
        },
    }, async (request) => {
        const actor = requireActorContext();
        const query = listAuditQuerySchema.parse(request.query);
        const result = await options.auditService.listEvents({
            tenantId: actor.tenantId,
            actorPermissions: actor.permissions,
            ...(query.eventType === undefined ? {} : { eventType: query.eventType }),
            ...(query.limit === undefined ? {} : { limit: query.limit }),
            ...(query.offset === undefined ? {} : { offset: query.offset }),
        });
        return {
            success: true,
            data: {
                total: result.total,
                events: result.events.map((event) => ({
                    id: event.id,
                    tenantId: event.tenantId,
                    actorKind: event.actorKind,
                    actorId: event.actorId,
                    eventType: event.eventType,
                    resourceType: event.resourceType,
                    resourceId: event.resourceId,
                    metadata: { ...event.metadata },
                    ipAddress: event.ipAddress,
                    requestId: event.requestId,
                    createdAt: event.createdAt.toISOString(),
                })),
            },
        };
    });
    await Promise.resolve();
};
export default auditRoutes;
