import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller.js';

export @Module({
  controllers: [AuthorizationController],
  providers: [],
})
class AuthorizationModule {}
