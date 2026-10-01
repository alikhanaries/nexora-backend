import { Controller, Get, Inject, Query } from '@nestjs/common';
import { listAuditQuerySchema } from '../../modules/audit/presentation/schemas.js';
import { AuditService } from './audit.service.js';

export @Controller()
class AuditController {
  constructor(@Inject(AuditService) auditService) {
    this.auditService = auditService;
  }

  @Get('/api/v1/audit')
  async list(@Query() query) {
    const parsed = listAuditQuerySchema.parse(query);
    const data = await this.auditService.listEvents(parsed);
    return { success: true, data };
  }
}
