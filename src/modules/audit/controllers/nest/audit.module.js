import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';

export @Module({
  controllers: [AuditController],
  providers: [],
})
class AuditModule {}
