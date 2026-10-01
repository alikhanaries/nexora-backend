import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';

export @Module({
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
})
class AuthorizationModule {}
