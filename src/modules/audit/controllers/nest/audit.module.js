/**
 * Nest module for audit event query APIs.
 * Registers AuditController; audit service comes from CORE_SERVICES at app bootstrap.
 */
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';

@Module({
  controllers: [AuditController],
  providers: [],
})
class AuditModule {}
export { AuditModule };
