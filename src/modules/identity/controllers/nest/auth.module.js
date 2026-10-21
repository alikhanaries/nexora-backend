import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

export @Module({
  controllers: [AuthController],
  providers: [],
})
class AuthModule {}
