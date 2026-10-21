import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller.js';

export @Module({
  controllers: [ApiKeysController],
  providers: [],
})
class ApiKeysModule {}
