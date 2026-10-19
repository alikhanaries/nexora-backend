import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';

export @Injectable()
class AuditService {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.coreServices = coreServices;
  }

  async listEvents(query) {
    const actor = requireActorContext();
    const auditService = this.coreServices.audit.routes.options.auditService;
    const result = await auditService.listEvents({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(query.eventType === undefined ? {} : { eventType: query.eventType }),
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.offset === undefined ? {} : { offset: query.offset }),
    });
    return {
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
    };
  }
}
