import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';

@Module({
  controllers: [AuditController],
  providers: [],
})
class AuditModule {}
export { AuditModule };
