import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';

@Module({
  controllers: [ReturnsController],
  providers: [],
})
class ReturnsModule {}
export { ReturnsModule };
