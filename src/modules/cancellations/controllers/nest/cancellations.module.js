import { Module } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller.js';

@Module({
  controllers: [CancellationsController],
  providers: [],
})
class CancellationsModule {}
export { CancellationsModule };
