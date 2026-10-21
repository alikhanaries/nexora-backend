import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller.js';

@Module({
  controllers: [AuthorizationController],
  providers: [],
})
class AuthorizationModule {}
export { AuthorizationModule };
