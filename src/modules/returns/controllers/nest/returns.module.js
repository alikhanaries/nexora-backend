import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';

export @Module({
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
class ReturnsModule {}
