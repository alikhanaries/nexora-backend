import { Inject, Injectable } from '@nestjs/common';
import { requireActorContext } from '../../shared/context/require-principal.js';
import { CORE_DOMAIN } from '../domain/core-domain.tokens.js';

export @Injectable()
class AuditService {
  constructor(@Inject(CORE_DOMAIN) coreDomain) {
    this.coreDomain = coreDomain;
  }

  async listEvents(query) {
    const actor = requireActorContext();
    const auditService = this.coreDomain.audit.routes.options.auditService;
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
