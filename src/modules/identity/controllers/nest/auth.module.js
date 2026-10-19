import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export @Module({
  controllers: [AuthController],
  providers: [AuthService],
})
class AuthModule {}
