import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';

export @Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
})
class ApiKeysModule {}
