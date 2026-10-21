import { Module } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller.js';

export @Module({
  controllers: [CancellationsController],
  providers: [],
})
class CancellationsModule {}
