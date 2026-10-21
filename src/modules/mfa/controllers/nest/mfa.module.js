import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller.js';

@Module({
  controllers: [MfaController],
  providers: [],
})
class MfaModule {}
export { MfaModule };
