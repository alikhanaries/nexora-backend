/**
 * Maps a domain audit event to the HTTP response DTO.
 * @param {import('../models/audit-event.js').AuditEvent} event
 */
export function toAuditEventResponse(event) {
  return {
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
  };
}
