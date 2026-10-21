import { Controller, Get, Inject, Query } from '@nestjs/common';
import { parseOrThrow } from '../../../../shared/validation/index.js';
import { requireActorContext } from '../../../../shared/context/require-principal.js';
import { CORE_SERVICES } from '../../../../app/di/core-services.tokens.js';
import { AUDIT_ROUTES } from '../../routes/audit.routes.js';
import { listAuditQuerySchema } from '../../views/audit.schemas.js';
import { toAuditEventResponse } from '../../views/audit.mapper.js';

/**
 * Thin Nest HTTP adapter — API methods only.
 */
export @Controller()
class AuditController {
  constructor(@Inject(CORE_SERVICES) coreServices) {
    this.auditService = coreServices.audit.auditService;
  }

  @Get(AUDIT_ROUTES.list.path)
  async list(@Query() query) {
    const parsed = parseOrThrow(listAuditQuerySchema, query, 'list audit');
    const actor = requireActorContext();
    const result = await this.auditService.listEvents({
      tenantId: actor.tenantId,
      actorPermissions: actor.permissions,
      ...(parsed.eventType === undefined ? {} : { eventType: parsed.eventType }),
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.offset === undefined ? {} : { offset: parsed.offset }),
    });
    return {
      success: true,
      data: {
        total: result.total,
        events: result.events.map(toAuditEventResponse),
      },
    };
  }
}
