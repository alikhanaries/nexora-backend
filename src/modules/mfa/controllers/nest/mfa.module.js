import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';

export @Module({
  controllers: [MfaController],
  providers: [MfaService],
})
class MfaModule {}
