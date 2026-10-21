import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';

export @Module({
  controllers: [ReturnsController],
  providers: [],
})
class ReturnsModule {}
