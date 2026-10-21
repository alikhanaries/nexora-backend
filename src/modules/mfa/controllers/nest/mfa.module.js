import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller.js';

export @Module({
  controllers: [MfaController],
  providers: [],
})
class MfaModule {}
