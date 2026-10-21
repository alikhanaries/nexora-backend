/**
 * Nest module for roles, permissions, and membership authorization APIs.
 * Registers AuthorizationController wired to CORE_SERVICES.authorization use cases.
 */
import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller.js';

@Module({
  controllers: [AuthorizationController],
  providers: [],
})
class AuthorizationModule {}
export { AuthorizationModule };
