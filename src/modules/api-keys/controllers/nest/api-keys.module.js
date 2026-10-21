import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller.js';

@Module({
  controllers: [ApiKeysController],
  providers: [],
})
class ApiKeysModule {}
export { ApiKeysModule };
