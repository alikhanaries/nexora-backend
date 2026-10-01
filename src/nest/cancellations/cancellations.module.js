import { Module } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller.js';
import { CancellationsService } from './cancellations.service.js';

export @Module({
  controllers: [CancellationsController],
  providers: [CancellationsService],
  exports: [CancellationsService],
})
class CancellationsModule {}
