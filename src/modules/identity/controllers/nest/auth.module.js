/**
 * Nest module for login, token refresh, and session identity endpoints.
 * Registers AuthController bound to CORE_SERVICES.identity use cases.
 */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [],
})
class AuthModule {}
export { AuthModule };
