/**
 * Nest module for TOTP enrollment and MFA verification endpoints.
 * Registers MfaController using CORE_SERVICES.mfa use cases.
 */
import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller.js';

@Module({
  controllers: [MfaController],
  providers: [],
})
class MfaModule {}
export { MfaModule };
