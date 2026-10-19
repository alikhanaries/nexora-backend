import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

export @Module({
  controllers: [AuditController],
  providers: [AuditService],
})
class AuditModule {}
